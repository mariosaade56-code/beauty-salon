import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();

  const appointment = await prisma.appointment.update({
    where: { id },
    data: body,
    include: { client: true, service: true, staff: true },
  });

  return NextResponse.json(appointment);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ ok: true });
}
