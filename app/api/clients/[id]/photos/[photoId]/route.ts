import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  await requireAdmin();
  const { photoId } = await params;
  const body = await req.json();
  const data: { takenAt?: Date; notes?: string | null } = {};
  if (body.takenAt) data.takenAt = new Date(body.takenAt);
  if ("notes" in body) data.notes = body.notes || null;
  const photo = await prisma.clientPhoto.update({ where: { id: photoId }, data });
  return NextResponse.json(photo);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  await requireAdmin();
  const { photoId } = await params;
  await prisma.clientPhoto.delete({ where: { id: photoId } });
  return NextResponse.json({ ok: true });
}
