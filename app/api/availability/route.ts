import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");
  const serviceIds = searchParams.get("serviceIds"); // comma-separated, for multi-service bookings
  const staffId = searchParams.get("staffId") || undefined;

  if (!date || (!serviceId && !serviceIds)) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const ids = serviceIds ? serviceIds.split(",").filter(Boolean) : serviceId!;
  const slots = await getAvailableSlots(new Date(date), ids, staffId);
  return NextResponse.json(slots);
}
