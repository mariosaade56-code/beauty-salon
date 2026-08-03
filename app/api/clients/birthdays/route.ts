import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { beirutDateStr } from "@/lib/timezone";

// Clients whose birthday falls on a given day, ignoring the year.
// Defaults to today in the salon's own timezone.
export async function GET(req: NextRequest) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") || beirutDateStr(new Date());
  const [, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!m || !d) return NextResponse.json([]);

  const rows = await prisma.$queryRaw<
    { id: string; name: string; phone: string; dob: Date }[]
  >`
    SELECT "id", "name", "phone", "dob"
    FROM "Client"
    WHERE "dob" IS NOT NULL
      AND EXTRACT(MONTH FROM "dob") = ${m}
      AND EXTRACT(DAY FROM "dob") = ${d}
    ORDER BY "name" ASC
  `;

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      dob: r.dob,
      // Only meaningful when a real year was entered
      turning: r.dob ? new Date(dateStr).getFullYear() - new Date(r.dob).getFullYear() : null,
    }))
  );
}
