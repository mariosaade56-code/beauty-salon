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

  // Log the sale in the client's transaction history the first time a
  // payment is recorded — whether that happens at completion or in advance
  // (a client who pays today for Saturday). Independent of attendance, so a
  // paid no-show still shows the money. Package sessions are skipped — their
  // money was logged when the package was purchased.
  const paymentJustRecorded = !!body.paymentStatus && !existing?.paymentStatus;
  if (
    paymentJustRecorded &&
    appointment &&
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
  const user = await requireAuth();
  const { id } = await params;
  // ?hard=1 removes the record entirely (admin only). Without it, the
  // appointment is just marked CANCELLED and stays in the history.
  const hard = new URL(req.url).searchParams.get("hard") === "1";

  if (hard && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only an admin can delete appointments" }, { status: 403 });
  }

  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Give the package session back if this booking was consuming one
  if (existing.clientPackageId && existing.status !== "CANCELLED") {
    await prisma.clientPackage.update({
      where: { id: existing.clientPackageId },
      data: { sessionsUsed: { decrement: 1 } },
    });
  }

  if (hard) {
    await prisma.appointment.delete({ where: { id } });
  } else {
    await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } });
  }

  return NextResponse.json({ ok: true });
}
