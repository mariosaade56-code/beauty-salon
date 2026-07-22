import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// Mark done (or reopen)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const item = await prisma.pendingWork.update({
    where: { id },
    data: { doneAt: body.done === false ? null : new Date() },
  });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  await prisma.pendingWork.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
