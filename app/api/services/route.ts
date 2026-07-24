import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // ?all=1 (logged in only) also returns hidden services so the Services
  // page can show them and switch them back on. Everything else — the public
  // booking page and the booking form — gets bookable services only.
  const wantAll = searchParams.get("all") === "1";
  const user = wantAll ? await getSession() : null;

  const services = await prisma.service.findMany({
    where: wantAll && user ? {} : { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json();
  const service = await prisma.service.create({ data: body });
  return NextResponse.json(service);
}
