import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();

  // Known fields only, rather than passing the request body straight through
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if ("brand" in body) data.brand = body.brand?.trim() || null;
  if ("category" in body) data.category = body.category?.trim() || null;
  if (body.cost != null) data.cost = Number(body.cost) || 0;
  if (body.price != null) data.price = Number(body.price) || 0;
  if ("discount" in body) {
    data.discount = body.discount === "" || body.discount == null ? null : Number(body.discount);
  }
  if (body.stock != null) data.stock = Number(body.stock) || 0;
  if (body.lowStockAt != null) data.lowStockAt = Number(body.lowStockAt) || 0;
  if ("notes" in body) data.notes = body.notes?.trim() || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  // Quick +1 / -1 from the stock buttons
  if (typeof body.stockDelta === "number") {
    const current = await prisma.product.findUnique({ where: { id }, select: { stock: true } });
    data.stock = Math.max((current?.stock ?? 0) + body.stockDelta, 0);
  }

  const product = await prisma.product.update({ where: { id }, data });
  return NextResponse.json(product);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
