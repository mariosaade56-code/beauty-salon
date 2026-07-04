import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const days = await prisma.dayOff.findMany({ orderBy: { date: "asc" }, include: { staff: true } });
  return NextResponse.json(days);
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json();
  const day = await prisma.dayOff.create({ data: { ...body, date: new Date(body.date) } });
  return NextResponse.json(day);
}

export async function DELETE(req: NextRequest) {
  await requireAdmin();
  const { id } = await req.json();
  await prisma.dayOff.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
