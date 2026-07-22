import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  try {
    const items = await prisma.pendingWork.findMany({
      where: { clientId: id },
      orderBy: [{ doneAt: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();
  if (!body.description?.trim()) {
    return NextResponse.json({ error: "Please say what is still to do" }, { status: 400 });
  }
  const item = await prisma.pendingWork.create({
    data: {
      clientId: id,
      description: body.description.trim(),
      fromService: body.fromService || null,
      appointmentId: body.appointmentId || null,
    },
  });
  return NextResponse.json(item);
}
