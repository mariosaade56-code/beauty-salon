import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth";

// Mark it used once the visit happens, or put it back if that was a slip
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if ("used" in body) data.usedAt = body.used === false ? null : new Date();
  if ("notes" in body) data.notes = body.notes?.trim() || null;

  // Settling the balance on something taken on credit
  if (typeof body.paid === "boolean") {
    data.paid = body.paid;
    const row = await prisma.prepayment.findUnique({ where: { id } });
    if (row?.transactionId) {
      await prisma.clientTransaction.updateMany({
        where: { id: row.transactionId },
        data: { paid: body.paid },
      });
    }
  }

  const updated = await prisma.prepayment.update({
    where: { id },
    data,
    include: { service: { select: { id: true, name: true, duration: true } } },
  });
  return NextResponse.json(updated);
}

// Removing it also clears the money from the client's history
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const row = await prisma.prepayment.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.transactionId) {
    await prisma.clientTransaction.deleteMany({ where: { id: row.transactionId } });
  }
  await prisma.prepayment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
