import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();
  if ("dob" in body) {
    body.dob = body.dob ? new Date(body.dob) : null;
  }
  const client = await prisma.client.update({ where: { id }, data: body });
  return NextResponse.json(client);
}

// Permanently remove a client and everything attached to them (admin only)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Children first — foreign keys point at the client
  await prisma.appointment.deleteMany({ where: { clientId: id } });
  await prisma.clientTransaction.deleteMany({ where: { clientId: id } });
  await prisma.clientPhoto.deleteMany({ where: { clientId: id } });
  await prisma.clientPackage.deleteMany({ where: { clientId: id } });
  await prisma.client.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
