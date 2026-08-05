import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const rows = await prisma.prepayment.findMany({
    where: { clientId: id },
    include: { service: { select: { id: true, name: true, duration: true } } },
    orderBy: [{ usedAt: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();

  // Several services paid for in one go. They share a group so the client's
  // file and the revenue list read them as the single deal they were.
  if (Array.isArray(body.items) && body.items.length) {
    const items = body.items;
    const services = await prisma.service.findMany({
      where: { id: { in: items.map((i: { serviceId: string }) => i.serviceId).filter(Boolean) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(services.map((s) => [s.id, s.name]));

    const parsed = items.map((i: { serviceId: string; sessionsTotal?: unknown; amount?: unknown }) => ({
      serviceId: i.serviceId,
      name: nameOf.get(i.serviceId),
      sessionsTotal: Math.max(Number(i.sessionsTotal) || 1, 1),
      amount: Number(i.amount) || 0,
    }));
    if (parsed.some((i: { name?: string }) => !i.name)) {
      return NextResponse.json({ error: "Service not found" }, { status: 400 });
    }
    const total = parsed.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    if (!(total > 0)) {
      return NextResponse.json({ error: "Enter how much was paid" }, { status: 400 });
    }

    const paid = body.paid !== false;
    const groupId = randomUUID();

    // One line in the client's history for the whole deal
    const label = parsed
      .map((i: { name: string; sessionsTotal: number }) =>
        i.sessionsTotal > 1 ? `${i.name} \u00d7 ${i.sessionsTotal}` : i.name)
      .join(" + ");
    const tx = await prisma.clientTransaction.create({
      data: {
        clientId: id,
        description: `${label} (paid in advance)`,
        amount: Math.round(total * 100) / 100,
        paid,
        reference: "Prepaid",
      },
    });

    const created = await Promise.all(
      parsed.map((i: { serviceId: string; sessionsTotal: number; amount: number }) =>
        prisma.prepayment.create({
          data: {
            clientId: id,
            serviceId: i.serviceId,
            amount: i.amount,
            paid,
            sessionsTotal: i.sessionsTotal,
            notes: body.notes?.trim() || null,
            transactionId: tx.id,
            groupId: parsed.length > 1 ? groupId : null,
          },
          include: { service: { select: { id: true, name: true, duration: true } } },
        })
      )
    );
    return NextResponse.json(created);
  }

  const single = await createPrepayment(id, body);
  if ("error" in single) return NextResponse.json({ error: single.error }, { status: 400 });
  return NextResponse.json(single);
}

async function createPrepayment(
  clientId: string,
  body: {
    serviceId?: string | null;
    description?: string | null;
    amount?: unknown;
    sessionsTotal?: unknown;
    paid?: boolean;
    notes?: string | null;
  }
) {
  const serviceId = body.serviceId || null;
  const service = serviceId
    ? await prisma.service.findUnique({ where: { id: serviceId } })
    : null;
  if (serviceId && !service) return { error: "Service not found" };

  const label = service?.name || body.description?.trim();
  if (!label) return { error: "Choose a service or describe what was paid for" };

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: `Enter how much was paid for ${label}` };
  }

  const paid = body.paid !== false;
  const sessionsTotal = Math.max(Number(body.sessionsTotal) || 1, 1);

  // Show the money in the client's own history straight away
  const tx = await prisma.clientTransaction.create({
    data: {
      clientId,
      description: `${label}${sessionsTotal > 1 ? ` \u00d7 ${sessionsTotal}` : ""} (paid in advance)`,
      amount,
      paid,
      reference: "Prepaid",
    },
  });

  return prisma.prepayment.create({
    data: {
      clientId,
      serviceId: service?.id ?? null,
      description: service ? null : (body.description || "").trim(),
      amount,
      paid,
      sessionsTotal,
      notes: body.notes?.trim() || null,
      transactionId: tx.id,
    },
    include: { service: { select: { id: true, name: true, duration: true } } },
  });
}
