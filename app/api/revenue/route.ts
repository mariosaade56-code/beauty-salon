import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { beirutDayRange } from "@/lib/timezone";

/**
 * What the salon actually took in over a period.
 *
 * Money is counted once, when it is collected — not when the treatment
 * happens. So a package or a prepaid deal counts on the day it was sold,
 * and the visits it later pays for add nothing. Anything still owed
 * (unpaid sales, balances due) is left out until it's settled.
 */
export async function GET(req: NextRequest) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }
  const [a, b] = from <= to ? [from, to] : [to, from];
  const gte = beirutDayRange(a).gte;
  const lt = beirutDayRange(b).lt;

  const [appointments, packageSales, productSales, prepayments] = await Promise.all([
    prisma.appointment.findMany({
      where: { startTime: { gte, lt } },
      select: {
        status: true,
        paymentStatus: true,
        amountPaid: true,
        clientPackageId: true,
        prepaymentId: true,
        service: { select: { price: true } },
      },
    }),
    // Package sales are logged to the client's file when sold; the unpaid
    // "balance due" row is excluded by paid: true.
    prisma.clientTransaction.findMany({
      where: { reference: "Package", paid: true, date: { gte, lt } },
      select: { amount: true },
    }),
    prisma.productSale.findMany({
      where: { paid: true, soldAt: { gte, lt } },
      select: { total: true, quantity: true },
    }),
    prisma.prepayment.findMany({
      where: { paid: true, createdAt: { gte, lt } },
      select: { amount: true },
    }),
  ]);

  // Per-visit money. A visit covered by a package or a prepaid deal adds
  // nothing — that money was counted when the client bought it.
  let services = 0;
  let servicesCount = 0;
  for (const x of appointments) {
    if (x.clientPackageId || x.prepaymentId) continue;
    if (x.paymentStatus) {
      // Counted whether or not they've been in yet — they've paid
      services += x.amountPaid ?? 0;
      servicesCount++;
    } else if (x.status === "COMPLETED") {
      // Older bookings finished without a payment ever being recorded
      services += x.service.price || 0;
      servicesCount++;
    }
  }

  const packages = packageSales.reduce((s, x) => s + x.amount, 0);
  const products = productSales.reduce((s, x) => s + x.total, 0);
  const prepaid = prepayments.reduce((s, x) => s + x.amount, 0);

  return NextResponse.json({
    services,
    packages,
    products,
    prepaid,
    total: Math.round((services + packages + products + prepaid) * 100) / 100,
    counts: {
      services: servicesCount,
      packages: packageSales.length,
      products: productSales.reduce((s, x) => s + x.quantity, 0),
      prepaid: prepayments.length,
    },
  });
}
