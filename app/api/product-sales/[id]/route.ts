import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Undo a sale: puts the stock back and clears the client's copy of it
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const sale = await prisma.productSale.findUnique({ where: { id } });
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (sale.transactionId) {
    await prisma.clientTransaction.deleteMany({ where: { id: sale.transactionId } });
  }

  await prisma.$transaction([
    prisma.product.update({
      where: { id: sale.productId },
      data: { stock: { increment: sale.quantity } },
    }),
    prisma.productSale.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
