import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; txId: string }> }) {
  await requireAdmin();
  const { txId } = await params;
  const body = await req.json();
  const tx = await prisma.clientTransaction.update({ where: { id: txId }, data: body });
  return NextResponse.json(tx);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; txId: string }> }) {
  await requireAdmin();
  const { txId } = await params;
  await prisma.clientTransaction.delete({ where: { id: txId } });
  return NextResponse.json({ ok: true });
}
