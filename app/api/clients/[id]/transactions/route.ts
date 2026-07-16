import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth(); // workers may see balances; editing stays admin-only
  const { id } = await params;
  const transactions = await prisma.clientTransaction.findMany({
    where: { clientId: id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(transactions);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();

  const tx = await prisma.clientTransaction.create({
    data: {
      clientId: id,
      date: body.date ? new Date(body.date) : new Date(),
      description: body.description,
      amount: parseFloat(body.amount),
      paid: body.paid ?? true,
      reference: body.reference || null,
    },
  });
  return NextResponse.json(tx);
}
