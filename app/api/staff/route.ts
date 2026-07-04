import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";

export async function GET() {
  await requireAuth();
  const staff = await prisma.staff.findMany({
    where: { isActive: true },
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
