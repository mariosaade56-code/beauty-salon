import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const clients = await prisma.client.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : {},
    include: {
      appointments: {
        orderBy: { startTime: "desc" },
        take: 1,
        include: { service: true },
      },
      _count: { select: { appointments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json();
  // Bulk import support
  if (Array.isArray(body)) {
    const results = await Promise.allSettled(
      body.map((c) =>
        prisma.client.upsert({
          where: { phone: c.phone },
          update: { name: c.name, email: c.email },
          create: { name: c.name, phone: c.phone, email: c.email },
        })
      )
    );
    return NextResponse.json({ imported: results.filter((r) => r.status === "fulfilled").length });
  }
  try {
    const client = await prisma.client.create({ data: body });
    return NextResponse.json(client);
  } catch (e: unknown) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "A client with this phone number already exists" }, { status: 400 });
    }
    throw e;
  }
}
