import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from && to) {
    where.date = {
      gte: new Date(new Date(from).toDateString()),
      lt: new Date(new Date(new Date(to).toDateString()).getTime() + 86400000),
    };
  }

  const expenses = await prisma.expense.findMany({ where, orderBy: { date: "desc" } });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json();
  if (!body.category || !body.amount) {
    return NextResponse.json({ error: "Category and amount are required" }, { status: 400 });
  }
  const expense = await prisma.expense.create({
    data: {
      date: body.date ? new Date(body.date) : new Date(),
      category: body.category,
      description: body.description || null,
      amount: parseFloat(body.amount),
    },
  });
  return NextResponse.json(expense);
}
