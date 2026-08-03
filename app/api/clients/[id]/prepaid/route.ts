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

  const serviceId = body.serviceId || null;
  const service = serviceId
    ? await prisma.service.findUnique({ where: { id: serviceId } })
    : null;
  if (serviceId && !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 400 });
  }

  const label = service?.name || body.description?.trim();
  if (!label) {
    return NextResponse.json({ error: "Choose a service or describe what was paid for" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter how much was paid" }, { status: 400 });
  }

  const paid = body.paid !== false;

  // Show the money in the client's own history straight away
  const tx = await prisma.clientTransaction.create({
    data: {
      clientId: id,
      description: `${label} (paid in advance)`,
      amount,
      paid,
      reference: "Prepaid",
    },
  });

  const row = await prisma.prepayment.create({
    data: {
      clientId: id,
      serviceId: service?.id ?? null,
      description: service ? null : body.description.trim(),
      amount,
      paid,
      notes: body.notes?.trim() || null,
      transactionId: tx.id,
    },
    include: { service: { select: { id: true, name: true, duration: true } } },
  });
  return NextResponse.json(row);
}
