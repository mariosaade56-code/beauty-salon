import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();
  if ("amountPaid" in body) {
    body.amountPaid = body.amountPaid != null ? parseFloat(body.amountPaid) : null;
  }

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

  // Log the sale in the client's transaction history when a service is
  // completed. Package sessions are skipped — the money was logged when
  // the package was purchased.
  if (
    body.status === "COMPLETED" &&
    existing &&
    existing.status !== "COMPLETED" &&
    !appointment.clientPackageId &&
    appointment.service.price
  ) {
    const price = appointment.service.price;
    const status = appointment.paymentStatus || "PAID";
    const paidAmount =
      status === "PAID" ? price : status === "PARTIAL" ? Math.min(appointment.amountPaid ?? 0, price) : 0;
    const balance = price - paidAmount;

    if (paidAmount > 0) {
      await prisma.clientTransaction.create({
        data: {
          clientId: appointment.clientId,
          date: appointment.startTime,
          description: status === "PARTIAL" ? `${appointment.service.name} (partial payment)` : appointment.service.name,
          amount: paidAmount,
          paid: true,
          reference: "Appointment",
        },
      });
    }
    if (balance > 0) {
      await prisma.clientTransaction.create({
        data: {
          clientId: appointment.clientId,
          date: appointment.startTime,
          description: `${appointment.service.name} (balance due)`,
          amount: balance,
          paid: false,
          reference: "Appointment",
        },
      });
    }
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
