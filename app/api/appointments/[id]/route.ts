import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.appointment.findUnique({ where: { id } });

  const appointment = await prisma.appointment.update({
    where: { id },
    data: body,
    include: { client: true, service: true, staff: true },
  });

  // Restore the package session if a package appointment gets cancelled
  if (
    body.status === "CANCELLED" &&
    existing?.clientPackageId &&
    existing.status !== "CANCELLED"
  ) {
    await prisma.clientPackage.update({
      where: { id: existing.clientPackageId },
      data: { sessionsUsed: { decrement: 1 } },
    });
  }

  return NextResponse.json(appointment);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;

  const existing = await prisma.appointment.findUnique({ where: { id } });
  await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } });

  if (existing?.clientPackageId && existing.status !== "CANCELLED") {
    await prisma.clientPackage.update({
      where: { id: existing.clientPackageId },
      data: { sessionsUsed: { decrement: 1 } },
    });
  }

  return NextResponse.json({ ok: true });
}
