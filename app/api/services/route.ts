import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const service = await prisma.service.create({ data: body });
  return NextResponse.json(service);
}
