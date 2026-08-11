"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Calendar, DollarSign, TrendingUp, Clock, X } from "lucide-react";
import PaymentBadge from "@/components/payment-badge";
import { birthdayLink, DEFAULT_BIRTHDAY_MESSAGE, BIRTHDAY_MESSAGE_KEY, COUNTRY_CODE_KEY } from "@/lib/messaging";

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

interface RevenueItem {
  id: string;
  kind: "service" | "package" | "product" | "prepaid" | "other";
  date: string;
  clientId: string | null;
  client: string;
  label: string;
  detail: string;
  amount: number;
}

interface Revenue {
  services: number;
  packages: number;
  products: number;
  prepaid: number;
  other: number;
  total: number;
  owed: number;
  counts: { services: number; packages: number; products: number; prepaid: number };
  items: { paid: RevenueItem[]; unpaid: RevenueItem[] };
}

interface Birthday {
  id: string;
  name: string;
  phone: string;
  turning: number | null;
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
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [showMoney, setShowMoney] = useState<"paid" | "unpaid" | null>(null);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [greeted, setGreeted] = useState<string[]>([]);
  const [msgTemplate, setMsgTemplate] = useState(DEFAULT_BIRTHDAY_MESSAGE);
  const [countryCode, setCountryCode] = useState("961");
  const [role, setRole] = useState<string>("ADMIN");
  const [todos, setTodos] = useState<{ id: string; description: string; fromService: string | null; createdAt: string; client: { id: string; name: string } }[]>([]);

  useEffect(() => {
    fetch("/api/pending").then((r) => (r.ok ? r.json() : [])).then((d) => setTodos(Array.isArray(d) ? d : [])).catch(() => {});
    // Today's birthdays, regardless of which period the stats are showing
    fetch("/api/clients/birthdays")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBirthdays(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s?.[BIRTHDAY_MESSAGE_KEY]) setMsgTemplate(s[BIRTHDAY_MESSAGE_KEY]);
        if (s?.[COUNTRY_CODE_KEY]) setCountryCode(s[COUNTRY_CODE_KEY]);
      })
      .catch(() => {});
    // Remembers who's been wished today, so the list doesn't nag
    try {
      const raw = localStorage.getItem(`greeted:${format(new Date(), "yyyy-MM-dd")}`);
      if (raw) setGreeted(JSON.parse(raw));
    } catch { /* private mode — just show everyone */ }
  }, []);

  function markGreeted(id: string) {
    setGreeted((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem(`greeted:${format(new Date(), "yyyy-MM-dd")}`, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }

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
    // Everything collected in the period, worked out server-side
    fetch(`/api/revenue?from=${a}&to=${b}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRevenue(d && typeof d.total === "number" ? d : null))
      .catch(() => setRevenue(null));
  }, [from, to]);

  const isStaff = role === "STAFF";
  const singleDay = from === to;

  const active = appointments
    .filter((a) => a.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const pending = active.filter((a) => a.status === "PENDING").length;
  const completed = active.filter((a) => a.status === "COMPLETED");
  // Where the money came from, for the line under the Revenue figure
  const revenueParts = revenue
    ? ([
        ["Services", revenue.services, ""],
        ["Packages", revenue.packages, ""],
        ["Products", revenue.products, revenue.counts.products ? ` (${revenue.counts.products})` : ""],
        ["Paid in advance", revenue.prepaid, ""],
        ["Other", revenue.other, ""],
      ] as const).filter(([, amount]) => amount > 0)
    : [];

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
        {!isStaff && (
          <button type="button" onClick={() => setShowMoney("paid")} className="text-left">
            <StatCard icon={DollarSign} label="Revenue" value={`$${(revenue?.total ?? 0).toFixed(0)}`} color="purple"
              note={revenueParts.length > 1
                ? revenueParts.map(([label, amount, extra]) => `${label} $${amount.toFixed(0)}${extra}`).join(" · ")
                : undefined}
              footer={
                <span className="text-pink-600">
                  See details{revenue && revenue.owed > 0 ? ` · $${revenue.owed.toFixed(0)} owed` : ""} →
                </span>
              } />
          </button>
        )}
      </div>

      {/* Every line of money for the period, paid and still owed */}
      {showMoney && revenue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMoney(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-5 border-b flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Money for {subtitle}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  ${revenue.total.toFixed(2)} collected
                  {revenue.owed > 0 && <span className="text-amber-600"> · ${revenue.owed.toFixed(2)} still owed</span>}
                </p>
              </div>
              <button onClick={() => setShowMoney(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="flex gap-1 px-5 pt-3 border-b flex-shrink-0">
              {([
                { key: "paid", label: `Paid (${revenue.items.paid.length})` },
                { key: "unpaid", label: `Unpaid (${revenue.items.unpaid.length})` },
              ] as const).map((t) => (
                <button key={t.key} onClick={() => setShowMoney(t.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${showMoney === t.key ? "border-pink-600 text-pink-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {(() => {
                const rows = showMoney === "paid" ? revenue.items.paid : revenue.items.unpaid;
                if (rows.length === 0) {
                  return (
                    <p className="text-center text-gray-400 py-10 text-sm">
                      {showMoney === "paid" ? "Nothing collected in this period" : "Nothing outstanding — all settled"}
                    </p>
                  );
                }
                const kindLabel: Record<string, string> = {
                  service: "Service", package: "Package", product: "Product", prepaid: "Paid in advance", other: "Other",
                };
                return (
                  <div className="space-y-2">
                    {rows.map((r) => (
                      <div key={`${r.kind}-${r.id}`}
                        className={`flex items-start justify-between gap-3 border rounded-xl px-3 py-2.5 ${showMoney === "unpaid" ? "border-amber-200 bg-amber-50" : "border-gray-200"}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {r.label}
                            <span className="font-normal text-gray-400 text-xs ml-1.5">{kindLabel[r.kind]}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(r.date), "d MMM, yyyy")}
                            {r.kind === "service" ? ` · ${format(new Date(r.date), "h:mm a")}` : ""}
                            {" · "}
                            {r.clientId ? (
                              <a href={`/admin/clients/${r.clientId}`} className="text-pink-600 hover:underline">{r.client}</a>
                            ) : r.client}
                            {r.detail ? ` · ${r.detail}` : ""}
                          </p>
                        </div>
                        <p className={`text-sm font-semibold flex-shrink-0 ${showMoney === "unpaid" ? "text-amber-700" : "text-gray-900"}`}>
                          ${r.amount.toFixed(2)}
                        </p>
                      </div>
                    ))}
                    <div className="flex justify-end border-t border-gray-100 pt-3 text-sm">
                      <span className="text-gray-500">
                        Total:{" "}
                        <span className="font-semibold text-gray-900">
                          ${rows.reduce((s, r) => s + r.amount, 0).toFixed(2)}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Birthdays today */}
      {birthdays.length > 0 && (
        <Card className="border-pink-300">
          <CardHeader>
            <CardTitle className="text-pink-800">
              🎂 Birthday today ({birthdays.length})
            </CardTitle>
            <p className="text-sm text-gray-500">Tap to send them a message on WhatsApp</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {birthdays.map((b) => {
                const done = greeted.includes(b.id);
                return (
                  <div key={b.id}
                    className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border ${done ? "border-gray-200 bg-gray-50" : "border-pink-200 bg-pink-50"}`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${done ? "text-gray-500" : "text-gray-900"}`}>
                        {b.name}
                        {b.turning && b.turning > 0 && b.turning < 120 && (
                          <span className="font-normal text-gray-500"> · turning {b.turning}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{b.phone}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {done && <Badge variant="success">Sent</Badge>}
                      <a
                        href={birthdayLink(b.phone, b.name, msgTemplate, countryCode)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markGreeted(b.id)}
                        className={`text-sm font-medium rounded-lg px-3 py-1.5 transition-colors ${done ? "text-gray-600 border border-gray-200 hover:bg-gray-100" : "bg-green-600 text-white hover:bg-green-700"}`}
                      >
                        {done ? "Send again" : "Send wishes"}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
  icon: Icon, label, value, color, note, footer,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  note?: string;
  footer?: React.ReactNode;
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
            {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
            {footer && <p className="text-xs font-medium mt-1.5">{footer}</p>}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
