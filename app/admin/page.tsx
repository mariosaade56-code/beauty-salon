"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Calendar, DollarSign, TrendingUp, Clock } from "lucide-react";
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

const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  CONFIRMED: "success",
  PENDING: "warning",
  CANCELLED: "destructive",
  COMPLETED: "success",
  NO_SHOW: "destructive",
};

export default function DashboardPage() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [role, setRole] = useState<string>("ADMIN");
  const [todos, setTodos] = useState<{ id: string; description: string; fromService: string | null; createdAt: string; client: { id: string; name: string } }[]>([]);

  useEffect(() => {
    fetch("/api/pending").then((r) => (r.ok ? r.json() : [])).then((d) => setTodos(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((u) => {
      if (u?.role) setRole(u.role);
    });
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    const [a, b] = from <= to ? [from, to] : [to, from];
    fetch(`/api/appointments?from=${a}&to=${b}`)
      .then((r) => r.json())
      .then((d) => setAppointments(Array.isArray(d) ? d : []));
  }, [from, to]);

  const isStaff = role === "STAFF";
  const singleDay = from === to;

  const active = appointments
    .filter((a) => a.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const pending = active.filter((a) => a.status === "PENDING").length;
  const completed = active.filter((a) => a.status === "COMPLETED");
  // Money actually collected: recorded payment if present, else full price
  const revenue = completed.reduce(
    (sum, a) => sum + (a.paymentStatus ? (a.amountPaid ?? 0) : (a.service.price || 0)),
    0
  );

  function preset(f: Date, t: Date) {
    setFrom(format(f, "yyyy-MM-dd"));
    setTo(format(t, "yyyy-MM-dd"));
  }

  const now = new Date();
  const subtitle = singleDay
    ? format(new Date(from + "T00:00:00"), "EEEE, MMMM d, yyyy")
    : `${format(new Date(from + "T00:00:00"), "MMM d")} – ${format(new Date(to + "T00:00:00"), "MMM d, yyyy")}`;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        </div>
        {/* Date filter */}
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => preset(now, now)}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => preset(startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 }))}>Week</Button>
            <Button variant="outline" size="sm" onClick={() => preset(startOfMonth(now), endOfMonth(now))}>Month</Button>
          </div>
        </div>
      </div>

      {/* Stats — strictly for the chosen period */}
      <div className={`grid grid-cols-2 ${isStaff ? "" : "md:grid-cols-4"} gap-3 md:gap-4`}>
        <StatCard icon={Calendar} label="Appointments" value={active.length} color="pink" />
        <StatCard icon={Clock} label="Pending" value={pending} color="yellow" />
        {!isStaff && <StatCard icon={TrendingUp} label="Completed" value={completed.length} color="green" />}
        {!isStaff && <StatCard icon={DollarSign} label="Revenue" value={`$${revenue.toFixed(0)}`} color="purple" />}
      </div>

      {/* Clients with unfinished work */}
      {todos.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-amber-900">⚠ Still to do ({todos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todos.map((t) => (
                <a key={t.id} href={`/admin/clients/${t.client.id}`}
                  className="flex items-center justify-between gap-2 bg-amber-50 hover:bg-amber-100 transition-colors rounded-lg px-3 py-2">
                  <span className="text-sm min-w-0">
                    <span className="font-semibold text-gray-900">{t.client.name}</span>
                    <span className="text-gray-700"> — {t.description}</span>
                    {t.fromService && <span className="text-gray-500"> (from {t.fromService})</span>}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{format(new Date(t.createdAt), "MMM d")}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>{singleDay ? "Schedule" : "Appointments in this period"}</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No appointments for this period</p>
          ) : (
            <div className="space-y-3">
              {active.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between p-3 md:p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[56px]">
                      {!singleDay && <p className="text-xs text-gray-400">{format(new Date(appt.startTime), "EEE d/M")}</p>}
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
