import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";

export async function GET() {
  await requireAuth();
  const products = await prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Please give the product a name" }, { status: 400 });
  }
  const product = await prisma.product.create({
    data: {
      name: body.name.trim(),
      brand: body.brand?.trim() || null,
      category: body.category?.trim() || null,
      cost: Number(body.cost) || 0,
      price: Number(body.price) || 0,
      discount: body.discount != null && body.discount !== "" ? Number(body.discount) : null,
      stock: Number(body.stock) || 0,
      lowStockAt: body.lowStockAt != null && body.lowStockAt !== "" ? Number(body.lowStockAt) : 3,
      notes: body.notes?.trim() || null,
    },
  });
  return NextResponse.json(product);
}
