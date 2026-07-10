"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar, Users, DollarSign, TrendingUp, Clock } from "lucide-react";
import PaymentBadge from "@/components/payment-badge";

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
  paymentStatus: string | null;
  amountPaid: number | null;
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
  const [role, setRole] = useState<string>("ADMIN");
  const today = new Date();

  useEffect(() => {
    const todayStr = format(today, "yyyy-MM-dd");
    fetch(`/api/appointments?date=${todayStr}`)
      .then((r) => r.json())
      .then(setTodayAppts);

    fetch("/api/auth/me").then((r) => r.json()).then((u) => {
      if (u?.role) setRole(u.role);
      if (u?.role !== "STAFF") {
        fetch(`/api/reports?period=month`)
          .then((r) => (r.ok ? r.json() : null))
          .then(setStats);
      }
    });
  }, []);

  const confirmed = todayAppts.filter((a) => a.status !== "CANCELLED");
  const isStaff = role === "STAFF";

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">{isStaff ? "My Day" : "Dashboard"}</h1>
        <p className="text-gray-500 text-sm mt-1">{format(today, "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Stats */}
      <div className={`grid grid-cols-2 ${isStaff ? "" : "md:grid-cols-4"} gap-3 md:gap-4`}>
        <StatCard icon={Calendar} label="Today" value={confirmed.length} color="pink" />
        <StatCard icon={Clock} label="Pending" value={todayAppts.filter((a) => a.status === "PENDING").length} color="yellow" />
        {!isStaff && <StatCard icon={TrendingUp} label="Completed" value={stats?.completed || 0} color="green" />}
        {!isStaff && <StatCard icon={DollarSign} label="Revenue" value={`$${(stats?.totalRevenue || 0).toFixed(0)}`} color="purple" />}
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
                <div key={appt.id} className="flex items-center justify-between p-3 md:p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[50px]">
                      <p className="font-semibold text-gray-900 text-sm">{format(new Date(appt.startTime), "h:mm")}</p>
                      <p className="text-xs text-gray-400">{format(new Date(appt.startTime), "a")}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{appt.client.name}</p>
                      <p className="text-xs text-gray-500">{appt.service.name} · {appt.staff?.name || "Any staff"}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={statusColors[appt.status] || "outline"}>
                      {appt.status}
                    </Badge>
                    <PaymentBadge status={appt.paymentStatus} amountPaid={appt.amountPaid} price={appt.service.price} />
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
