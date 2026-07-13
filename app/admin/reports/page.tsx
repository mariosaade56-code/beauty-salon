"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface ReportData {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  cancellationRate: number;
  totalRevenue: number;
  byService: { name: string; count: number; revenue: number }[];
  byStaff: { name: string; count: number; revenue: number }[];
  byHour: Record<string, number>;
  bySource: Record<string, number>;
}

const COLORS = ["#ec4899", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");

  useEffect(() => {
    fetch(`/api/reports?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d && typeof d.total === "number" ? d : null));
  }, [period]);

  const hourData = data
    ? Object.entries(data.byHour)
        .map(([h, count]) => ({ hour: `${h}:00`, count }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour))
    : [];

  const sourceData = data
    ? Object.entries(data.bySource).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Reports</h1>
        <div className="flex gap-2">
          {(["day", "week", "month"] as const).map((p) => (
            <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Appointments", value: data.total },
              { label: "Completed", value: data.completed },
              { label: "Cancelled", value: `${data.cancellationRate.toFixed(1)}%` },
              { label: "Revenue", value: `$${data.totalRevenue.toFixed(0)}` },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Service */}
            <Card>
              <CardHeader><CardTitle>Revenue by Service</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.byService.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-gray-700">{s.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${s.revenue.toFixed(0)}</p>
                        <p className="text-xs text-gray-400">{s.count} bookings</p>
                      </div>
                    </div>
                  ))}
                  {data.byService.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No data</p>}
                </div>
              </CardContent>
            </Card>

            {/* Revenue by Staff */}
            <Card>
              <CardHeader><CardTitle>Revenue by Staff</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.byStaff.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-gray-700">{s.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${s.revenue.toFixed(0)}</p>
                        <p className="text-xs text-gray-400">{s.count} bookings</p>
                      </div>
                    </div>
                  ))}
                  {data.byStaff.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No data</p>}
                </div>
              </CardContent>
            </Card>

            {/* Busiest Hours */}
            <Card>
              <CardHeader><CardTitle>Busiest Hours</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourData}>
                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Booking Source */}
            <Card>
              <CardHeader><CardTitle>Booking Sources</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                        {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
