import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staffId");
  const breaks = await prisma.break.findMany({
    where: staffId ? { staffId } : {},
    include: { staff: true },
  });
  return NextResponse.json(breaks);
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json();
  const brk = await prisma.break.create({
    data: {
      staffId: body.staffId,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      label: body.label,
      dayOfWeek: body.dayOfWeek ?? null,
    },
  });
  return NextResponse.json(brk);
}

export async function DELETE(req: NextRequest) {
  await requireAdmin();
  const { id } = await req.json();
  await prisma.break.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
