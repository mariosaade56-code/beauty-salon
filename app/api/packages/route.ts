import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = await getSession();

  // Public (booking page): only active packages, no client data.
  // ?public=1 forces this view even when an admin is logged in.
  if (!user || searchParams.get("public")) {
    const packages = await prisma.package.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        sessionCount: true,
        validityDays: true,
        serviceId: true,
        service: { select: { name: true, duration: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(packages);
  }

  const packages = await prisma.package.findMany({
    include: {
      service: { select: { name: true, category: true } },
      clientPackages: {
        include: { client: { select: { id: true, name: true, phone: true } } },
        orderBy: { purchasedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(packages);
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json();
  const pkg = await prisma.package.create({
    data: {
      name: body.name,
      serviceId: body.serviceId,
      sessionCount: body.sessionCount,
      price: body.price,
      validityDays: body.validityDays ?? 365,
    },
    include: { service: { select: { name: true } } },
  });
  return NextResponse.json(pkg);
}
