import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, getSession } from "@/lib/auth";

// Order real technicians first, each immediately followed by its helper slots
function groupByParent<T extends { id: string; parentId: string | null }>(list: T[]): T[] {
  const parents = list.filter((s) => !s.parentId);
  const helpersOf = (id: string) => list.filter((s) => s.parentId === id);
  const out: T[] = [];
  for (const p of parents) {
    out.push(p);
    out.push(...helpersOf(p.id));
  }
  // Any orphan helpers (parent inactive) at the end
  for (const s of list) if (s.parentId && !out.includes(s)) out.push(s);
  return out;
}

export async function GET() {
  const user = await getSession();

  // Public (not logged in): real technicians only, minimal fields
  if (!user) {
    const staff = await prisma.staff.findMany({
      where: { isActive: true, overbook: false },
      select: { id: true, name: true, color: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(staff);
  }

  // Logged in (staff or admin): full grouped list incl. helper slots.
  // Account data (email/role) is admin-only.
  const staff = await prisma.staff.findMany({
    where: { isActive: true },
    include: user.role === "ADMIN"
      ? { user: { select: { email: true, role: true, isActive: true } } }
      : undefined,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(groupByParent(staff));
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json();
  const staff = await prisma.staff.create({ data: body });
  return NextResponse.json(staff);
}
