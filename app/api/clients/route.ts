import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { beirutDateStr } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  await requireAuth(); // workers can view and search clients
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
    },
    orderBy: { createdAt: "desc" },
  });

  // A visit is a day the client came in. Several treatments in one day are
  // one visit, and only completed ones count.
  const done = await prisma.appointment.findMany({
    where: { status: "COMPLETED", clientId: { in: clients.map((c) => c.id) } },
    select: { clientId: true, startTime: true },
  });
  const daysByClient = new Map<string, Set<string>>();
  for (const a of done) {
    const key = beirutDateStr(a.startTime);
    const set = daysByClient.get(a.clientId);
    if (set) set.add(key);
    else daysByClient.set(a.clientId, new Set([key]));
  }

  return NextResponse.json(
    clients.map((c) => ({
      ...c,
      _count: { appointments: daysByClient.get(c.id)?.size ?? 0 },
    }))
  );
}

export async function POST(req: NextRequest) {
  await requireAuth();
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
