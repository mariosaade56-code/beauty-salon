import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "month"; // day | week | month
  const dateStr = searchParams.get("date") || new Date().toISOString();
  const date = new Date(dateStr);

  let start: Date, end: Date;
  if (period === "day") { start = startOfDay(date); end = endOfDay(date); }
  else if (period === "week") { start = startOfWeek(date); end = endOfWeek(date); }
  else { start = startOfMonth(date); end = endOfMonth(date); }

  const appointments = await prisma.appointment.findMany({
    where: { startTime: { gte: start, lte: end } },
    include: { service: true, staff: true, client: true },
  });

  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const cancelled = appointments.filter((a) => a.status === "CANCELLED");
  const noShow = appointments.filter((a) => a.status === "NO_SHOW");

  const totalRevenue = completed.reduce((sum, a) => sum + (a.service.price || 0), 0);

  // Revenue by service
  type ServiceStat = { name: string; count: number; revenue: number };
  type StaffStat = { name: string; count: number; revenue: number };

  const byService: Record<string, ServiceStat> = {};
  for (const a of completed) {
    if (!byService[a.serviceId]) byService[a.serviceId] = { name: a.service.name, count: 0, revenue: 0 };
    byService[a.serviceId].count++;
    byService[a.serviceId].revenue += a.service.price || 0;
  }

  const byStaff: Record<string, StaffStat> = {};
  for (const a of completed) {
    const key = a.staffId || "unassigned";
    if (!byStaff[key]) byStaff[key] = { name: a.staff?.name || "Unassigned", count: 0, revenue: 0 };
    byStaff[key].count++;
    byStaff[key].revenue += a.service.price || 0;
  }

  const byHour: Record<number, number> = {};
  for (const a of appointments) {
    const hour = new Date(a.startTime).getHours();
    byHour[hour] = (byHour[hour] || 0) + 1;
  }

  const bySource: Record<string, number> = {};
  for (const a of appointments) {
    bySource[a.source] = (bySource[a.source] || 0) + 1;
  }

  return NextResponse.json({
    period,
    total: appointments.length,
    completed: completed.length,
    cancelled: cancelled.length,
    noShow: noShow.length,
    cancellationRate: appointments.length ? (cancelled.length / appointments.length) * 100 : 0,
    totalRevenue,
    byService: Object.values(byService).sort((a: ServiceStat, b: ServiceStat) => b.revenue - a.revenue),
    byStaff: Object.values(byStaff).sort((a: StaffStat, b: StaffStat) => b.revenue - a.revenue),
    byHour,
    bySource,
  });
}
