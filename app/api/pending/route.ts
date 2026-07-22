import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// Every open "still to do" item, newest first (dashboard + reminders).
// Returns [] rather than failing if the table hasn't been created yet.
export async function GET() {
  await requireAuth();
  try {
    const items = await prisma.pendingWork.findMany({
      where: { doneAt: null },
      include: { client: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json([]);
  }
}
