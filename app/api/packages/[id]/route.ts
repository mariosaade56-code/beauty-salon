import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();

  // Only accept known fields rather than passing the request body through
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (body.sessionCount != null) data.sessionCount = Number(body.sessionCount);
  if (body.price != null) data.price = Number(body.price);
  if (body.validityDays != null) data.validityDays = Number(body.validityDays);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  // Replace the covered services when a new list is given
  if (Array.isArray(body.serviceIds) && body.serviceIds.length) {
    data.serviceId = body.serviceIds[0];
    data.services = { set: body.serviceIds.map((sid: string) => ({ id: sid })) };
  }

  const pkg = await prisma.package.update({
    where: { id },
    data,
    include: { services: { select: { id: true, name: true } } },
  });
  return NextResponse.json(pkg);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  await prisma.package.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
