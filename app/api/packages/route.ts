import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const packages = await prisma.package.findMany({
    include: { service: { select: { name: true, category: true } } },
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
