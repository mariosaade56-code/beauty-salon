import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();

  // Public (booking page) only needs names and colors
  if (!user || user.role !== "ADMIN") {
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(staff);
  }

  const staff = await prisma.staff.findMany({
    where: { isActive: true },
    include: { user: { select: { email: true, role: true, isActive: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json();
  const staff = await prisma.staff.create({ data: body });
  return NextResponse.json(staff);
}
