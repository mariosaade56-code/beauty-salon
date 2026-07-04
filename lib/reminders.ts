import { prisma } from "./db";
import { sendWhatsAppMessage } from "./whatsapp";
import { format } from "date-fns";

export async function sendReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);

  // 24-hour reminders
  const upcoming24 = await prisma.appointment.findMany({
    where: {
      status: { in: ["CONFIRMED", "PENDING"] },
      reminderSent24h: false,
      startTime: { gte: now, lte: in24h },
    },
    include: { client: true, service: true, staff: true },
  });

  for (const appt of upcoming24) {
    const msg = `Hi ${appt.client.name}! 👋\n\nReminder: You have an appointment tomorrow!\n\n💅 ${appt.service.name}\n👤 ${appt.staff?.name || "Any staff"}\n⏰ ${format(appt.startTime, "h:mm a")}\n\nSee you then! ✨`;
    await sendWhatsAppMessage(appt.client.phone, msg);
    await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSent24h: true } });
  }

  // 1-hour reminders
  const upcoming1h = await prisma.appointment.findMany({
    where: {
      status: { in: ["CONFIRMED", "PENDING"] },
      reminderSent1h: false,
      startTime: { gte: now, lte: in1h },
    },
    include: { client: true, service: true, staff: true },
  });

  for (const appt of upcoming1h) {
    const msg = `⏰ Heads up ${appt.client.name}!\n\nYour appointment is in about 1 hour:\n\n💅 ${appt.service.name}\n⏰ ${format(appt.startTime, "h:mm a")}\n\nWe look forward to seeing you! 💕`;
    await sendWhatsAppMessage(appt.client.phone, msg);
    await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSent1h: true } });
  }

  return { sent24h: upcoming24.length, sent1h: upcoming1h.length };
}
