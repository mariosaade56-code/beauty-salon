import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packages = await prisma.clientPackage.findMany({
    where: { clientId: id },
    include: {
      package: { include: { service: { select: { name: true, category: true } } } },
      appointments: { select: { id: true, startTime: true, status: true } },
    },
    orderBy: { purchasedAt: "desc" },
  });
  return NextResponse.json(packages);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();

  const pkg = await prisma.package.findUnique({ where: { id: body.packageId } });
  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });

  const expiresAt = pkg.validityDays
    ? new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000)
    : null;

  const cp = await prisma.clientPackage.create({
    data: {
      clientId: id,
      packageId: body.packageId,
      sessionsTotal: pkg.sessionCount,
      sessionsUsed: 0,
      expiresAt,
      notes: body.notes ?? null,
    },
    include: { package: { include: { service: { select: { name: true } } } } },
  });

  // Log the package sale in the client's transaction history
  await prisma.clientTransaction.create({
    data: {
      clientId: id,
      description: `${pkg.name} (${pkg.sessionCount} sessions)`,
      amount: pkg.price,
      paid: true,
      reference: "Package",
    },
  });

  return NextResponse.json(cp);
}
