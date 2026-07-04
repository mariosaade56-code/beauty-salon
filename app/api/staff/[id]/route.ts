import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  const staff = await prisma.staff.update({ where: { id }, data: body });
  return NextResponse.json(staff);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  await prisma.staff.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
