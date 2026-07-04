import { NextRequest, NextResponse } from "next/server";
import { sendReminders } from "@/lib/reminders";

// Called by a cron job every 15 minutes
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendReminders();
  return NextResponse.json(result);
}
