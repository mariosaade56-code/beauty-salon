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
        id: true,
        startTime: true,
        status: true,
        paymentStatus: true,
        amountPaid: true,
        finalPrice: true,
        clientPackageId: true,
        prepaymentId: true,
        client: { select: { id: true, name: true, phone: true } },
        staff: { select: { name: true } },
        service: { select: { name: true, price: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    // Package sales are logged to the client's file when sold. The unpaid
    // "balance due" row rides along so it can be listed as still owed.
    prisma.clientTransaction.findMany({
      where: { reference: "Package", date: { gte, lt } },
      select: { id: true, amount: true, paid: true, date: true, description: true, client: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.productSale.findMany({
      where: { soldAt: { gte, lt } },
      select: {
        id: true, total: true, quantity: true, paid: true, soldAt: true,
        product: { select: { name: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { soldAt: "asc" },
    }),
    prisma.prepayment.findMany({
      where: { createdAt: { gte, lt } },
      select: {
        id: true, amount: true, paid: true, createdAt: true, description: true, sessionsTotal: true,
        service: { select: { name: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  type Item = {
    id: string;
    kind: "service" | "package" | "product" | "prepaid";
    date: Date;
    clientId: string | null;
    client: string;
    label: string;
    detail: string;
    amount: number;
  };
  const paidItems: Item[] = [];
  const unpaidItems: Item[] = [];

  // Per-visit money. A visit covered by a package or a prepaid deal adds
  // nothing — that money was counted when the client bought it.
  let services = 0;
  let servicesCount = 0;
  for (const x of appointments) {
    // Already paid for when the package or deal was bought
    if (x.clientPackageId || x.prepaymentId) continue;

    const base = {
      id: x.id,
      kind: "service" as const,
      date: x.startTime,
      clientId: x.client?.id ?? null,
      client: x.client?.name ?? "—",
      label: x.service.name,
      detail: [x.staff?.name, x.status.replace("_", "-").toLowerCase()].filter(Boolean).join(" · "),
    };
    const price = x.finalPrice ?? x.service.price ?? 0;
    if (x.paymentStatus) {
      // Counted whether or not they've been in yet — they've paid
      const got = x.amountPaid ?? 0;
      if (got > 0) {
        services += got;
        servicesCount++;
        paidItems.push({ ...base, amount: got });
      }
      const owed = Math.round((price - got) * 100) / 100;
      if (owed > 0) unpaidItems.push({ ...base, amount: owed });
    } else if (x.status === "COMPLETED") {
      // Older bookings finished without a payment ever being recorded
      services += x.service.price || 0;
      servicesCount++;
      paidItems.push({ ...base, amount: x.service.price || 0, detail: `${base.detail} · no payment recorded` });
    }
  }

  for (const x of packageSales) {
    const item = {
      id: x.id, kind: "package" as const, date: x.date,
      clientId: x.client?.id ?? null, client: x.client?.name ?? "—",
      label: x.description, detail: "package", amount: x.amount,
    };
    (x.paid ? paidItems : unpaidItems).push(item);
  }

  for (const x of productSales) {
    const item = {
      id: x.id, kind: "product" as const, date: x.soldAt,
      clientId: x.client?.id ?? null, client: x.client?.name ?? "walk-in",
      label: x.product.name, detail: x.quantity > 1 ? `${x.quantity} sold` : "1 sold",
      amount: x.total,
    };
    (x.paid ? paidItems : unpaidItems).push(item);
  }

  for (const x of prepayments) {
    const item = {
      id: x.id, kind: "prepaid" as const, date: x.createdAt,
      clientId: x.client?.id ?? null, client: x.client?.name ?? "—",
      label: x.service?.name ?? x.description ?? "Paid in advance",
      detail: x.sessionsTotal > 1 ? `${x.sessionsTotal} sessions · paid in advance` : "paid in advance",
      amount: x.amount,
    };
    (x.paid ? paidItems : unpaidItems).push(item);
  }

  const packages = packageSales.filter((x) => x.paid).reduce((s, x) => s + x.amount, 0);
  const products = productSales.filter((x) => x.paid).reduce((s, x) => s + x.total, 0);
  const prepaid = prepayments.filter((x) => x.paid).reduce((s, x) => s + x.amount, 0);

  const byDate = (a: Item, b: Item) => a.date.getTime() - b.date.getTime();
  paidItems.sort(byDate);
  unpaidItems.sort(byDate);

  return NextResponse.json({
    services,
    packages,
    products,
    prepaid,
    total: Math.round((services + packages + products + prepaid) * 100) / 100,
    counts: {
      services: servicesCount,
      packages: packageSales.filter((x) => x.paid).length,
      products: productSales.filter((x) => x.paid).reduce((s, x) => s + x.quantity, 0),
      prepaid: prepayments.filter((x) => x.paid).length,
    },
    owed: Math.round(unpaidItems.reduce((s, x) => s + x.amount, 0) * 100) / 100,
    items: { paid: paidItems, unpaid: unpaidItems },
  });
}
