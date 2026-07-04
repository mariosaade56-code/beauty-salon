import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const status = searchParams.get("status");
  const staffId = searchParams.get("staffId");

  const where: Record<string, unknown> = {};
  if (date) {
    const d = new Date(date);
    where.startTime = {
      gte: new Date(d.toDateString()),
      lt: new Date(d.getTime() + 86400000),
    };
  }
  if (status) where.status = status;
  if (staffId) where.staffId = staffId;
  if (user.role === "STAFF" && user.staffProfile) {
    where.staffId = user.staffProfile.id;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: { client: true, service: true, staff: true },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(appointments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientName, phone, email, serviceId, staffId, startTime, notes, source } = body;

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 400 });

  const start = new Date(startTime);
  const end = new Date(start.getTime() + service.duration * 60000);

  // Upsert client
  let client = await prisma.client.findUnique({ where: { phone } });
  if (!client) {
    client = await prisma.client.create({ data: { name: clientName, phone, email } });
  }

  const appointment = await prisma.appointment.create({
    data: {
      clientId: client.id,
      serviceId,
      staffId: staffId || null,
      startTime: start,
      endTime: end,
      status: "CONFIRMED",
      source: source || "WEBSITE",
      notes,
    },
    include: { client: true, service: true, staff: true },
  });

  // Send WhatsApp confirmation
  const confirmMsg = `✅ Appointment Confirmed!\n\nHi ${client.name}! Your booking is set:\n\n💅 ${service.name}\n👤 ${appointment.staff?.name || "Any available staff"}\n📅 ${format(start, "EEEE, MMMM d, yyyy")}\n⏰ ${format(start, "h:mm a")}\n\nSee you soon! 💕`;
  await sendWhatsAppMessage(phone, confirmMsg).catch(console.error);

  return NextResponse.json(appointment);
}
