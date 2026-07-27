import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { beirutDayRange } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Salon-local days, same as expenses — the server runs on UTC
  const where =
    from && to
      ? { soldAt: { gte: beirutDayRange(from).gte, lt: beirutDayRange(to).lt } }
      : {};

  const sales = await prisma.productSale.findMany({
    where,
    include: {
      product: { select: { name: true, brand: true } },
      client: { select: { id: true, name: true } },
    },
    orderBy: { soldAt: "desc" },
    take: from && to ? undefined : 50,
  });
  return NextResponse.json(sales);
}

export async function POST(req: Request) {
  await requireAuth();
  const body = await req.json();

  const product = await prisma.product.findUnique({ where: { id: body.productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const quantity = Math.max(Number(body.quantity) || 1, 1);
  if (quantity > product.stock) {
    return NextResponse.json(
      { error: `Only ${product.stock} left in stock` },
      { status: 400 }
    );
  }

  // Price defaults to the product's current price after its own discount
  const unitPrice =
    body.unitPrice != null && body.unitPrice !== ""
      ? Number(body.unitPrice)
      : Math.round(product.price * (1 - (product.discount ?? 0) / 100) * 100) / 100;
  const total = Math.round(unitPrice * quantity * 100) / 100;
  const paid = body.paid !== false;

  // If the buyer is a known client, mirror the sale into their file
  let transactionId: string | null = null;
  if (body.clientId) {
    const tx = await prisma.clientTransaction.create({
      data: {
        clientId: body.clientId,
        description: `${product.name}${quantity > 1 ? ` x${quantity}` : ""}`,
        amount: total,
        paid,
        reference: "Product",
      },
    });
    transactionId = tx.id;
  }

  const [sale] = await prisma.$transaction([
    prisma.productSale.create({
      data: {
        productId: product.id,
        clientId: body.clientId || null,
        quantity,
        unitPrice,
        unitCost: product.cost,
        total,
        paid,
        notes: body.notes?.trim() || null,
        transactionId,
      },
      include: { product: { select: { name: true } }, client: { select: { id: true, name: true } } },
    }),
    prisma.product.update({
      where: { id: product.id },
      data: { stock: { decrement: quantity } },
    }),
  ]);

  return NextResponse.json(sale);
}
