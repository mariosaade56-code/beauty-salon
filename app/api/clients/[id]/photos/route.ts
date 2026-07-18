import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const photos = await prisma.clientPhoto.findMany({
    where: { clientId: id },
    orderBy: { takenAt: "desc" },
  });
  return NextResponse.json(photos);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();

  const photo = await prisma.clientPhoto.create({
    data: {
      clientId: id,
      url: body.url,
      type: body.type ?? "GENERAL",
      notes: body.notes ?? null,
      takenAt: body.takenAt ? new Date(body.takenAt) : new Date(),
    },
  });
  return NextResponse.json(photo);
}
