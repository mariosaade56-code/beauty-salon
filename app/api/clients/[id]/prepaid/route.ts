import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

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

  // Several services paid for in one go — each becomes its own entry so it
  // can be booked and used up independently.
  if (Array.isArray(body.items) && body.items.length) {
    const created = [];
    for (const item of body.items) {
      const row = await createPrepayment(id, {
        serviceId: item.serviceId || null,
        description: item.description,
        amount: item.amount,
        sessionsTotal: item.sessionsTotal,
        paid: body.paid,
        notes: body.notes,
      });
      if ("error" in row) return NextResponse.json({ error: row.error }, { status: 400 });
      created.push(row);
    }
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
