import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  await requireAdmin();
  const { photoId } = await params;
  await prisma.clientPhoto.delete({ where: { id: photoId } });
  return NextResponse.json({ ok: true });
}
