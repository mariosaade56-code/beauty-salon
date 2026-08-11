import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { Appointment } from "@prisma/client";

type SwitchResult =
  | { error: string }
  | { clientPackageId: string | null; serviceId?: string };

/**
 * Moves an appointment onto a package, off one, or between two — giving back
 * the session it was using and taking one from the new package. A package the
 * client doesn't own yet is created and its sale logged, exactly as booking
 * one from scratch does.
 */
async function switchPackage(
  existing: Appointment,
  newPackageId: string | null,
  body: Record<string, unknown>
): Promise<SwitchResult> {
  const current = existing.clientPackageId
    ? await prisma.clientPackage.findUnique({ where: { id: existing.clientPackageId } })
    : null;

  // Already on this package — leave the session count alone
  if (current && newPackageId && current.packageId === newPackageId) {
    return { clientPackageId: current.id };
  }

  // Hand back the session the appointment was holding
  if (current && existing.status !== "CANCELLED") {
    await prisma.clientPackage.update({
      where: { id: current.id },
      data: { sessionsUsed: { decrement: 1 } },
    });
  }

  if (!newPackageId) return { clientPackageId: null };

  const pkg = await prisma.package.findUnique({
    where: { id: newPackageId },
    include: { services: { select: { id: true } } },
  });
  if (!pkg) return { error: "Package not found" };

  // Reuse a package the client already has sessions left on
  const owned = await prisma.clientPackage.findMany({
    where: {
      clientId: existing.clientId,
      packageId: pkg.id,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: { purchasedAt: "asc" },
  });
  let clientPackageId = owned.find((cp) => cp.sessionsUsed < cp.sessionsTotal)?.id ?? null;

  if (!clientPackageId) {
    const created = await prisma.clientPackage.create({
      data: {
        clientId: existing.clientId,
        packageId: pkg.id,
        sessionsTotal: pkg.sessionCount,
        expiresAt: pkg.validityDays ? new Date(Date.now() + pkg.validityDays * 86400000) : null,
      },
    });
    clientPackageId = created.id;

    // Log the sale — what was handed over now, and what's still owed
    const pStatus =
      body.packagePaymentStatus === "PAID" || body.packagePaymentStatus === "PARTIAL"
        ? body.packagePaymentStatus
        : "UNPAID";
    const paidAmount =
      pStatus === "PAID"
        ? pkg.price
        : pStatus === "PARTIAL"
        ? Math.min(parseFloat(String(body.packageAmountPaid ?? "0")) || 0, pkg.price)
        : 0;
    const balance = pkg.price - paidAmount;
    if (paidAmount > 0) {
      await prisma.clientTransaction.create({
        data: {
          clientId: existing.clientId,
          description: `${pkg.name} (${pkg.sessionCount} sessions)${pStatus === "PARTIAL" ? " (partial payment)" : ""}`,
          amount: paidAmount,
          paid: true,
          reference: "Package",
        },
      });
    }
    if (balance > 0) {
      await prisma.clientTransaction.create({
        data: {
          clientId: existing.clientId,
          description: `${pkg.name} (balance due)`,
          amount: balance,
          paid: false,
          reference: "Package",
        },
      });
    }
  }

  // Take this visit's session
  await prisma.clientPackage.update({
    where: { id: clientPackageId },
    data: { sessionsUsed: { increment: 1 } },
  });

  // Keep the booked service if the package covers it, else fall back
  const covered = new Set([pkg.serviceId, ...pkg.services.map((s) => s.id)]);
  const asked = typeof body.serviceId === "string" ? body.serviceId : null;
  const serviceId =
    asked && covered.has(asked)
      ? asked
      : covered.has(existing.serviceId)
      ? existing.serviceId
      : pkg.serviceId;

  return { clientPackageId, serviceId };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Known fields only — the request body also carries package instructions
  // that aren't columns on Appointment.
  const data: Record<string, unknown> = {};
  if (typeof body.status === "string") data.status = body.status;
  if ("notes" in body) data.notes = body.notes || null;
  if ("staffId" in body) data.staffId = body.staffId || null;
  if ("paymentStatus" in body) data.paymentStatus = body.paymentStatus || null;
  if ("amountPaid" in body) data.amountPaid = body.amountPaid != null ? parseFloat(body.amountPaid) : null;
  if ("finalPrice" in body) data.finalPrice = body.finalPrice != null ? parseFloat(body.finalPrice) : null;

  // Swapping the service also moves the end time, since durations differ
  if (typeof body.serviceId === "string" && body.serviceId !== existing.serviceId) {
    const svc = await prisma.service.findUnique({ where: { id: body.serviceId } });
    if (!svc) return NextResponse.json({ error: "Service not found" }, { status: 400 });
    data.serviceId = svc.id;
    data.endTime = new Date(existing.startTime.getTime() + svc.duration * 60000);
    // A different service invalidates a price agreed for the old one
    if (!("finalPrice" in body)) data.finalPrice = null;
  }

  // "the employee talked them into a package" — attach or detach one.
  // Only acts when the caller explicitly sends the key.
  if ("packageId" in body) {
    const newPackageId: string | null = body.packageId || null;
    const result = await switchPackage(existing, newPackageId, body);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    data.clientPackageId = result.clientPackageId;
    if (result.serviceId) {
      const svc = await prisma.service.findUnique({ where: { id: result.serviceId } });
      if (svc) {
        data.serviceId = svc.id;
        data.endTime = new Date(existing.startTime.getTime() + svc.duration * 60000);
      }
    }
    // A package session isn't billed per visit
    if (result.clientPackageId) {
      data.paymentStatus = null;
      data.amountPaid = null;
      data.finalPrice = null;
    }
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data,
    include: { client: true, service: true, staff: true },
  });

  // Restore the package session if a package appointment gets cancelled.
  // Skipped when this same request already rearranged the packages, which
  // handles the session count itself.
  if (
    !("packageId" in body) &&
    body.status === "CANCELLED" &&
    existing?.clientPackageId &&
    existing.status !== "CANCELLED"
  ) {
    await prisma.clientPackage.update({
      where: { id: existing.clientPackageId },
      data: { sessionsUsed: { decrement: 1 } },
    });
  }

  // Same for a session drawn from a one-off prepaid deal
  if (
    body.status === "CANCELLED" &&
    existing?.prepaymentId &&
    existing.status !== "CANCELLED"
  ) {
    await prisma.prepayment.update({
      where: { id: existing.prepaymentId },
      data: { sessionsUsed: { decrement: 1 }, usedAt: null },
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
    // A prepaid visit was already charged when the deal was recorded
    !appointment.prepaymentId &&
    appointment.service.price
  ) {
    // What was actually agreed — a discount at the till, or the salon-wide
    // offer — rather than the service's list price.
    const price = appointment.finalPrice ?? appointment.service.price;
    const discounted = price < appointment.service.price;
    const status = appointment.paymentStatus || "PAID";
    const paidAmount =
      status === "PAID" ? price : status === "PARTIAL" ? Math.min(appointment.amountPaid ?? 0, price) : 0;
    const balance = price - paidAmount;

    // A $0 visit still gets a line, so a comped or fully discounted
    // treatment is visible in the client's record rather than silently absent
    if (paidAmount > 0 || price === 0) {
      const label = price === 0
        ? `${appointment.service.name} (free${appointment.service.price ? ` — normally $${appointment.service.price}` : ""})`
        : discounted
        ? `${appointment.service.name} (discounted from $${appointment.service.price})`
        : appointment.service.name;
      await prisma.clientTransaction.create({
        data: {
          clientId: appointment.clientId,
          date: appointment.startTime,
          description: status === "PARTIAL" ? `${label} (partial payment)` : label,
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
  if (existing.prepaymentId && existing.status !== "CANCELLED") {
    await prisma.prepayment.update({
      where: { id: existing.prepaymentId },
      data: { sessionsUsed: { decrement: 1 }, usedAt: null },
    });
  }

  if (hard) {
    await prisma.appointment.delete({ where: { id } });
  } else {
    await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } });
  }

  return NextResponse.json({ ok: true });
}
