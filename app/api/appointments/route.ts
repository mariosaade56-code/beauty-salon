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
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const staffId = searchParams.get("staffId");

  const where: Record<string, unknown> = {};
  if (from && to) {
    // Range fetch (calendar week view); `to` is inclusive
    where.startTime = {
      gte: new Date(new Date(from).toDateString()),
      lt: new Date(new Date(new Date(to).toDateString()).getTime() + 86400000),
    };
  } else if (date) {
    const d = new Date(date);
    where.startTime = {
      gte: new Date(d.toDateString()),
      lt: new Date(d.getTime() + 86400000),
    };
  }
  if (status) where.status = status;
  if (staffId) where.staffId = staffId;

  const appointments = await prisma.appointment.findMany({
    where,
    include: { client: true, service: true, staff: true },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(appointments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientName, phone, email, staffId, startTime, notes, source, packageId, serviceIds } = body;
  let { serviceId } = body;

  // Multi-service booking: create consecutive appointments with the same staff
  if (Array.isArray(serviceIds) && serviceIds.length > 1) {
    const found = await prisma.service.findMany({ where: { id: { in: serviceIds } } });
    if (found.length !== serviceIds.length) {
      return NextResponse.json({ error: "Service not found" }, { status: 400 });
    }
    const byId = Object.fromEntries(found.map((s) => [s.id, s]));

    let client = await prisma.client.findUnique({ where: { phone } });
    if (!client) {
      client = await prisma.client.create({ data: { name: clientName, phone, email } });
    }

    const created = [];
    let cursor = new Date(startTime);
    for (const id of serviceIds) {
      const svc = byId[id];
      const end = new Date(cursor.getTime() + svc.duration * 60000);
      created.push(
        await prisma.appointment.create({
          data: {
            clientId: client.id,
            serviceId: id,
            staffId: staffId || null,
            startTime: cursor,
            endTime: end,
            status: "CONFIRMED",
            source: source || "WEBSITE",
            notes,
          },
          include: { client: true, service: true, staff: true },
        })
      );
      cursor = end;
    }

    const first = created[0];
    const list = created.map((a) => `💅 ${a.service.name}`).join("\n");
    const confirmMsg = `✅ Appointment Confirmed!\n\nHi ${client.name}! Your booking is set:\n\n${list}\n👤 ${first.staff?.name || "Any available staff"}\n📅 ${format(first.startTime, "EEEE, MMMM d, yyyy")}\n⏰ ${format(first.startTime, "h:mm a")}\n\nSee you soon! 💕`;
    await sendWhatsAppMessage(phone, confirmMsg).catch(console.error);

    return NextResponse.json({ appointments: created });
  }

  if (Array.isArray(serviceIds) && serviceIds.length === 1) serviceId = serviceIds[0];

  // If booking against a package, the service comes from the package
  const pkg = packageId ? await prisma.package.findUnique({ where: { id: packageId } }) : null;
  if (packageId && !pkg) return NextResponse.json({ error: "Package not found" }, { status: 400 });
  if (pkg) serviceId = pkg.serviceId;

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 400 });

  const start = new Date(startTime);
  const end = new Date(start.getTime() + service.duration * 60000);

  // Upsert client
  let client = await prisma.client.findUnique({ where: { phone } });
  if (!client) {
    client = await prisma.client.create({ data: { name: clientName, phone, email } });
  }

  // Find the client's package with remaining sessions, or auto-assign a new one
  let clientPackageId: string | null = null;
  if (pkg) {
    const existing = await prisma.clientPackage.findMany({
      where: {
        clientId: client.id,
        packageId: pkg.id,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      orderBy: { purchasedAt: "asc" },
    });
    const withRemaining = existing.find((cp) => cp.sessionsUsed < cp.sessionsTotal);
    if (withRemaining) {
      clientPackageId = withRemaining.id;
    } else {
      const created = await prisma.clientPackage.create({
        data: {
          clientId: client.id,
          packageId: pkg.id,
          sessionsTotal: pkg.sessionCount,
          expiresAt: pkg.validityDays ? new Date(Date.now() + pkg.validityDays * 86400000) : null,
        },
      });
      clientPackageId = created.id;
      // Log the package sale in the client's transaction history
      await prisma.clientTransaction.create({
        data: {
          clientId: client.id,
          description: `${pkg.name} (${pkg.sessionCount} sessions)`,
          amount: pkg.price,
          paid: true,
          reference: "Package",
        },
      });
    }
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
      clientPackageId,
    },
    include: { client: true, service: true, staff: true },
  });

  // Deduct one session from the package
  if (clientPackageId) {
    await prisma.clientPackage.update({
      where: { id: clientPackageId },
      data: { sessionsUsed: { increment: 1 } },
    });
  }

  // Send WhatsApp confirmation
  const confirmMsg = `✅ Appointment Confirmed!\n\nHi ${client.name}! Your booking is set:\n\n💅 ${service.name}\n👤 ${appointment.staff?.name || "Any available staff"}\n📅 ${format(start, "EEEE, MMMM d, yyyy")}\n⏰ ${format(start, "h:mm a")}\n\nSee you soon! 💕`;
  await sendWhatsAppMessage(phone, confirmMsg).catch(console.error);

  return NextResponse.json(appointment);
}
