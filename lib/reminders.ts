import { prisma } from "./db";
import { sendWhatsAppMessage } from "./whatsapp";
import { beirutFormat } from "./timezone";

const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };

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
    const msg = `Hi ${appt.client.name}! 👋\n\nReminder: You have an appointment tomorrow!\n\n💅 ${appt.service.name}\n👤 ${appt.staff?.name || "Any staff"}\n⏰ ${beirutFormat(appt.startTime, timeOpts)}\n\nSee you then! ✨`;
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
    const msg = `⏰ Heads up ${appt.client.name}!\n\nYour appointment is in about 1 hour:\n\n💅 ${appt.service.name}\n⏰ ${beirutFormat(appt.startTime, timeOpts)}\n\nWe look forward to seeing you! 💕`;
    await sendWhatsAppMessage(appt.client.phone, msg);
    await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSent1h: true } });
  }

  // Rebooking reminders: find completed appointments where service has reminderDays set
  // Send reminder 7 days before the due date (i.e., reminderDays - 7 days after appointment)
  const completedWithReminder = await prisma.appointment.findMany({
    where: {
      status: "COMPLETED",
      rebookReminderSent: false,
      service: { reminderDays: { not: null } },
    },
    include: { client: true, service: true },
  });

  let sentRebook = 0;
  for (const appt of completedWithReminder) {
    if (!appt.service.reminderDays) continue;
    const reminderDate = new Date(appt.startTime);
    reminderDate.setDate(reminderDate.getDate() + appt.service.reminderDays - 7);
    if (reminderDate <= now) {
      const dueDate = new Date(appt.startTime);
      dueDate.setDate(dueDate.getDate() + appt.service.reminderDays);
      const msg = `Hi ${appt.client.name}! 💕\n\nIt's almost time for your next ${appt.service.name} session!\n\n📅 Your next session is recommended around ${beirutFormat(dueDate, { month: "long", day: "numeric" })}.\n\nBook now to secure your slot! ✨\nReply here or visit our website to book.`;
      await sendWhatsAppMessage(appt.client.phone, msg);
      await prisma.appointment.update({ where: { id: appt.id }, data: { rebookReminderSent: true } });
      sentRebook++;
    }
  }

  return { sent24h: upcoming24.length, sent1h: upcoming1h.length, sentRebook };
}
