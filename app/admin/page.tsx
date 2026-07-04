"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar, Users, DollarSign, TrendingUp, Clock } from "lucide-react";

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
  client: { name: string; phone: string };
  service: { name: string; price: number | null };
  staff: { name: string } | null;
}

interface Stats {
  total: number;
  completed: number;
  totalRevenue: number;
}

const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  CONFIRMED: "success",
  PENDING: "warning",
  CANCELLED: "destructive",
  COMPLETED: "success",
  NO_SHOW: "destructive",
};

export default function DashboardPage() {
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const today = new Date();

  useEffect(() => {
    const todayStr = format(today, "yyyy-MM-dd");
    fetch(`/api/appointments?date=${todayStr}`)
      .then((r) => r.json())
      .then(setTodayAppts);

    fetch(`/api/reports?period=month`)
      .then((r) => r.json())
      .then(setStats);
  }, []);

  const confirmed = todayAppts.filter((a) => a.status !== "CANCELLED");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{format(today, "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Today's Appointments" value={confirmed.length} color="pink" />
        <StatCard icon={Clock} label="Pending Today" value={todayAppts.filter((a) => a.status === "PENDING").length} color="yellow" />
        <StatCard icon={TrendingUp} label="Month Completed" value={stats?.completed || 0} color="green" />
        <StatCard icon={DollarSign} label="Month Revenue" value={`$${(stats?.totalRevenue || 0).toFixed(0)}`} color="purple" />
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {confirmed.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No appointments today</p>
          ) : (
            <div className="space-y-3">
              {confirmed.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <p className="font-semibold text-gray-900 text-sm">
                        {format(new Date(appt.startTime), "h:mm")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(appt.startTime), "a")}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{appt.client.name}</p>
                      <p className="text-sm text-gray-500">{appt.service.name} · {appt.staff?.name || "Any staff"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{appt.source}</span>
                    <Badge variant={statusColors[appt.status] || "outline"}>
                      {appt.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    pink: "bg-pink-50 text-pink-600",
    yellow: "bg-yellow-50 text-yellow-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
