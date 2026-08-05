import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { beirutDayRange } from "@/lib/timezone";

// Money taken in advance across all clients, for the revenue figures.
export async function GET(req: NextRequest) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Salon-local days, matching expenses and product sales
  const where =
    from && to
      ? { createdAt: { gte: beirutDayRange(from).gte, lt: beirutDayRange(to).lt } }
      : {};

  const rows = await prisma.prepayment.findMany({
    where,
    select: {
      id: true,
      amount: true,
      paid: true,
      createdAt: true,
      sessionsTotal: true,
      description: true,
      service: { select: { name: true } },
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows);
}
