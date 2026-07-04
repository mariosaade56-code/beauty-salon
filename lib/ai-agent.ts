import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { getAvailableSlots } from "./availability";
import { sendWhatsAppMessage } from "./whatsapp";
import { format, parse, addDays, nextDay } from "date-fns";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a helpful booking assistant for a beauty salon. You understand English, Arabic, and Lebanese dialect (Arabic written in English letters, e.g. "baddi ahji" = "I want to book").

Your job:
1. Understand what service the client wants (manicure/nails, pedicure, facial, slimming, laser, etc.)
2. Understand which staff member they prefer (if any)
3. Understand the desired date/day (e.g. "tuesday", "tomorrow", "el tnen")
4. Understand the preferred time (morning/afternoon/evening or specific time)
5. Show available slots and collect booking info (name, phone)

Always respond in the same language the user used. Be warm and friendly. Keep responses short.

When you have enough info to check availability, respond with JSON action:
{"action": "check_availability", "service": "...", "date": "YYYY-MM-DD", "staffName": "..." or null}

When user selects a time and provides name:
{"action": "book", "service": "...", "date": "YYYY-MM-DD", "time": "HH:MM", "staffId": "...", "clientName": "...", "phone": "..."}

When just chatting or asking questions, respond normally as text.`;

export async function handleWhatsAppAI(phone: string, userMessage: string): Promise<string> {
  // Get or create session
  let session = await prisma.whatsappSession.findUnique({ where: { phone } });
  if (!session) {
    session = await prisma.whatsappSession.create({
      data: { phone, state: "idle", data: {} },
    });
  }

  const history = (session.data as { messages?: { role: string; content: string }[] }).messages || [];

  history.push({ role: "user", content: userMessage });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: history as { role: "user" | "assistant"; content: string }[],
  });

  const assistantText = response.content[0].type === "text" ? response.content[0].text : "";

  // Try to parse action JSON
  const jsonMatch = assistantText.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const action = JSON.parse(jsonMatch[0]);

      if (action.action === "check_availability") {
        const services = await prisma.service.findMany({ where: { isActive: true } });
        const matchedService = services.find((s: { name: string }) =>
          s.name.toLowerCase().includes(action.service?.toLowerCase() || "")
        );

        if (!matchedService) {
          const reply = "Sorry, I couldn't find that service. Available services: " +
            services.map((s: { name: string }) => s.name).join(", ");
          await updateSession(phone, history, reply);
          return reply;
        }

        let staff = null;
        if (action.staffName) {
          staff = await prisma.staff.findFirst({
            where: { name: { contains: action.staffName, mode: "insensitive" }, isActive: true },
          });
        }

        const date = new Date(action.date);
        const slots = await getAvailableSlots(date, matchedService.id, staff?.id);

        if (slots.length === 0) {
          const reply = `No available slots for ${matchedService.name} on ${format(date, "EEEE, MMM d")}. Would you like to try another day?`;
          await updateSession(phone, history, reply);
          return reply;
        }

        const slotList = slots.slice(0, 8).map((s) => `• ${s.time}${staff ? "" : " with " + s.staffName}`).join("\n");
        const reply = `Available times for ${matchedService.name} on ${format(date, "EEEE, MMM d")}:\n${slotList}\n\nWhich time works for you?`;

        // Save context for booking
        await prisma.whatsappSession.update({
          where: { phone },
          data: {
            state: "selecting_time",
            data: {
              messages: [...history, { role: "assistant", content: reply }],
              serviceId: matchedService.id,
              date: action.date,
              slots,
            },
          },
        });
        return reply;
      }

      if (action.action === "book") {
        const sessionData = session.data as {
          serviceId?: string;
          slots?: { time: string; staffId: string; staffName: string }[];
        };

        const serviceId = action.serviceId || sessionData.serviceId;
        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        const staffId = action.staffId || sessionData.slots?.find((s) => s.time === action.time)?.staffId;

        if (!service || !staffId) {
          return "Something went wrong. Please start over — what service would you like?";
        }

        const startTime = new Date(`${action.date}T${action.time}:00`);
        const endTime = new Date(startTime.getTime() + service.duration * 60000);

        // Upsert client
        let clientRecord = await prisma.client.findUnique({ where: { phone } });
        if (!clientRecord) {
          clientRecord = await prisma.client.create({
            data: { name: action.clientName || "WhatsApp Customer", phone },
          });
        }

        const appointment = await prisma.appointment.create({
          data: {
            clientId: clientRecord.id,
            staffId,
            serviceId: service.id,
            startTime,
            endTime,
            status: "CONFIRMED",
            source: "WHATSAPP",
          },
          include: { staff: true },
        });

        const reply = `✅ Booked! Here's your confirmation:\n\n📍 Service: ${service.name}\n👤 Staff: ${appointment.staff?.name || "Any available"}\n📅 ${format(startTime, "EEEE, MMM d")}\n⏰ ${format(startTime, "h:mm a")}\n\nYou'll receive reminders before your appointment. See you soon! 💅`;

        await prisma.whatsappSession.update({
          where: { phone },
          data: { state: "idle", data: { messages: [] } },
        });
        return reply;
      }
    } catch {
      // Not valid JSON action, treat as text
    }
  }

  history.push({ role: "assistant", content: assistantText });
  await updateSession(phone, history, null);
  return assistantText;
}

async function updateSession(
  phone: string,
  history: { role: string; content: string }[],
  assistantReply: string | null
) {
  const updatedHistory = assistantReply
    ? [...history, { role: "assistant", content: assistantReply }]
    : history;

  await prisma.whatsappSession.update({
    where: { phone },
    data: { data: { messages: updatedHistory.slice(-20) } }, // keep last 20 messages
  });
}
