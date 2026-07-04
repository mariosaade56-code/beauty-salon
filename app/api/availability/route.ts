import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");
  const staffId = searchParams.get("staffId") || undefined;

  if (!date || !serviceId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const slots = await getAvailableSlots(new Date(date), serviceId, staffId);
  return NextResponse.json(slots);
}
