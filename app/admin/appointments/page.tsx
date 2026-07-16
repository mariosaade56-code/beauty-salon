"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format, addDays, startOfWeek, isSameDay, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Phone, X } from "lucide-react";
import NewAppointmentModal from "@/components/admin/new-appointment-modal";
import PaymentBadge from "@/components/payment-badge";

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
  notes: string | null;
  clientPackageId: string | null;
  paymentStatus: string | null;
  amountPaid: number | null;
  client: { name: string; phone: string };
  service: { name: string; price: number | null; duration: number };
  staff: { name: string; color: string } | null;
}

const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  CONFIRMED: "success",
  PENDING: "warning",
  CANCELLED: "destructive",
  COMPLETED: "success",
  NO_SHOW: "destructive",
};

const OPEN = 9;   // salon opens
const CLOSE = 18; // salon closes
const HOUR_PX = 64;

function hourLabel(h: number) {
  return `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
}

export default function AppointmentsPage() {
  const [anchor, setAnchor] = useState(new Date());
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekKey = format(weekStart, "yyyy-MM-dd");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [prefill, setPrefill] = useState<{ date: string; time: string } | null>(null);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [payFor, setPayFor] = useState<Appointment | null>(null);
  const [payMode, setPayMode] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [payAmount, setPayAmount] = useState("");
  const [now, setNow] = useState(new Date());

  async function load() {
    const from = format(days[0], "yyyy-MM-dd");
    const to = format(days[6], "yyyy-MM-dd");
    const data = await fetch(`/api/appointments?from=${from}&to=${to}`).then((r) => r.json());
    setAppointments(Array.isArray(data) ? data : []);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [weekKey]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    load();
  }

  // "Done" asks how the client paid — unless it's a package session or a free service
  function startComplete(appt: Appointment) {
    if (appt.clientPackageId || !appt.service.price) {
      updateStatus(appt.id, "COMPLETED");
      return;
    }
    setPayMode("PAID");
    setPayAmount("");
    setPayFor(appt);
  }

  async function confirmComplete() {
    if (!payFor) return;
    const price = payFor.service.price || 0;
    const amountPaid = payMode === "PAID" ? price : payMode === "PARTIAL" ? parseFloat(payAmount || "0") : 0;
    await fetch(`/api/appointments/${payFor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", paymentStatus: payMode, amountPaid }),
    });
    setPayFor(null);
    load();
  }

  function slotClick(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const mins = OPEN * 60 + Math.floor(((y / HOUR_PX) * 60) / 30) * 30;
    const clamped = Math.min(Math.max(mins, OPEN * 60), CLOSE * 60 - 30);
    const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
    const mm = String(clamped % 60).padStart(2, "0");
    setPrefill({ date: format(day, "yyyy-MM-dd"), time: `${hh}:${mm}` });
    setShowNew(true);
  }

  const active = appointments.filter((a) => a.status !== "CANCELLED");

  // Google-style lanes: overlapping appointments share the column width
  function layoutDay(day: Date) {
    const dayAppts = active
      .filter((a) => isSameDay(new Date(a.startTime), day))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const laneEnds: number[] = [];
    const placed = dayAppts.map((a) => {
      const s = new Date(a.startTime).getTime();
      const e = new Date(a.endTime).getTime();
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane === -1) { laneEnds.push(e); lane = laneEnds.length - 1; }
      else laneEnds[lane] = e;
      return { a, lane };
    });
    return { placed, laneCount: Math.max(laneEnds.length, 1) };
  }

  const hours = Array.from({ length: CLOSE - OPEN }, (_, i) => OPEN + i);
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) - OPEN * 60) / 60 * HOUR_PX;
  const nowVisible = now.getHours() >= OPEN && now.getHours() < CLOSE;

  return (
    <div className="p-4 md:p-6 space-y-4 flex flex-col h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Appointments</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(weekStart, -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-gray-900 text-sm md:text-base min-w-[150px] text-center">
            {format(days[0], "MMM d")} – {format(days[6], "MMM d, yyyy")}
          </span>
          <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(weekStart, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>Today</Button>
          <Button size="sm" onClick={() => { setPrefill(null); setShowNew(true); }}>
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>
      </div>

      {/* Week grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-auto flex-1">
        <div className="min-w-[860px]">
          {/* Day headers */}
          <div className="grid border-b border-gray-200 sticky top-0 bg-white z-20" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            <div />
            {days.map((d) => (
              <div key={d.toISOString()} className="py-2 text-center border-l border-gray-100">
                <p className="text-xs text-gray-500">{format(d, "EEE")}</p>
                <p className={`text-lg font-semibold w-9 h-9 mx-auto flex items-center justify-center rounded-full ${isToday(d) ? "bg-pink-600 text-white" : "text-gray-900"}`}>
                  {format(d, "d")}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            {/* Hour gutter */}
            <div className="relative" style={{ height: (CLOSE - OPEN) * HOUR_PX }}>
              {hours.map((h) => (
                <span key={h} className="absolute right-2 text-[11px] text-gray-400 -translate-y-1/2"
                  style={{ top: (h - OPEN) * HOUR_PX }}>
                  {h === OPEN ? "" : hourLabel(h)}
                </span>
              ))}
            </div>

            {days.map((day) => {
              const { placed, laneCount } = layoutDay(day);
              return (
                <div key={day.toISOString()}
                  className="relative border-l border-gray-100 cursor-pointer"
                  style={{ height: (CLOSE - OPEN) * HOUR_PX }}
                  onClick={(e) => slotClick(day, e)}>
                  {/* hour + half-hour lines */}
                  {hours.map((h) => (
                    <div key={h}>
                      <div className="absolute left-0 right-0 border-t border-gray-100" style={{ top: (h - OPEN) * HOUR_PX }} />
                      <div className="absolute left-0 right-0 border-t border-gray-50" style={{ top: (h - OPEN) * HOUR_PX + HOUR_PX / 2 }} />
                    </div>
                  ))}

                  {/* now indicator */}
                  {isToday(day) && nowVisible && (
                    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowTop }}>
                      <div className="border-t-2 border-red-500 relative">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full absolute -left-1 -top-[6px]" />
                      </div>
                    </div>
                  )}

                  {/* appointment blocks */}
                  {placed.map(({ a, lane }) => {
                    const s = new Date(a.startTime);
                    const e = new Date(a.endTime);
                    const top = ((s.getHours() * 60 + s.getMinutes()) - OPEN * 60) / 60 * HOUR_PX;
                    const height = Math.max(((e.getTime() - s.getTime()) / 60000 / 60) * HOUR_PX, 22);
                    const width = 100 / laneCount;
                    const done = a.status === "COMPLETED";
                    const noShow = a.status === "NO_SHOW";
                    return (
                      <button key={a.id} type="button"
                        onClick={(ev) => { ev.stopPropagation(); setDetail(a); }}
                        className={`absolute rounded-md px-1.5 py-0.5 text-left overflow-hidden text-white shadow-sm hover:shadow-md transition-shadow z-[5] ${done || noShow ? "opacity-60" : ""}`}
                        style={{
                          top,
                          height,
                          left: `calc(${lane * width}% + 2px)`,
                          width: `calc(${width}% - 4px)`,
                          backgroundColor: a.staff?.color || "#9ca3af",
                        }}>
                        <p className="text-[11px] font-semibold leading-tight truncate">
                          {done ? "✓ " : noShow ? "✗ " : ""}{a.client.name}
                        </p>
                        <p className="text-[10px] leading-tight truncate opacity-90">
                          {format(s, "h:mm")} · {a.service.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showNew && (
        <NewAppointmentModal
          initialDate={prefill?.date}
          initialTime={prefill?.time}
          onClose={() => { setShowNew(false); setPrefill(null); }}
          onCreated={() => { setShowNew(false); setPrefill(null); load(); }}
        />
      )}

      {/* Appointment detail */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{detail.client.name}</h2>
                <p className="text-sm text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {detail.client.phone}</p>
              </div>
              <button onClick={() => setDetail(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="text-sm space-y-1.5">
              <p className="text-gray-900 font-medium">
                {detail.service.name}{detail.service.price ? ` · $${detail.service.price}` : ""}
              </p>
              <p className="text-gray-500">
                {format(new Date(detail.startTime), "EEEE, MMM d")} · {format(new Date(detail.startTime), "h:mm a")} – {format(new Date(detail.endTime), "h:mm a")}
              </p>
              {detail.staff && (
                <p className="text-gray-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: detail.staff.color }} />
                  {detail.staff.name}
                </p>
              )}
              {detail.notes && <p className="text-gray-500 italic">{detail.notes}</p>}
              <div className="flex gap-1.5 pt-1">
                <Badge variant={statusColors[detail.status] || "outline"}>{detail.status}</Badge>
                <PaymentBadge status={detail.paymentStatus} amountPaid={detail.amountPaid} price={detail.service.price} />
                <Badge variant="outline">{detail.source}</Badge>
              </div>
            </div>
            {detail.status === "CONFIRMED" && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => { const a = detail; setDetail(null); startComplete(a); }}>Done</Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => { updateStatus(detail.id, "NO_SHOW"); setDetail(null); }}>No-show</Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => { cancel(detail.id); setDetail(null); }}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment prompt on completion */}
      {payFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Complete Appointment</h2>
              <p className="text-sm text-gray-500 mt-1">
                {payFor.client.name} · {payFor.service.name} · <span className="font-semibold text-gray-900">${payFor.service.price}</span>
              </p>
            </div>
            <div className="space-y-2">
              {([
                { value: "PAID", label: `Paid in full ($${payFor.service.price})` },
                { value: "PARTIAL", label: "Partially paid" },
                { value: "UNPAID", label: "Not paid" },
              ] as const).map((opt) => (
                <label key={opt.value}
                  className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${payMode === opt.value ? "border-pink-600 bg-pink-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name="paymode" checked={payMode === opt.value} onChange={() => setPayMode(opt.value)} />
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                </label>
              ))}
              {payMode === "PARTIAL" && (
                <div className="pl-1 pt-1">
                  <label className="block text-xs text-gray-500 mb-1">Amount paid ($)</label>
                  <Input type="number" step="0.01" min={0} max={payFor.service.price || undefined}
                    value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="e.g. 20" autoFocus />
                  {payAmount && payFor.service.price && (
                    <p className="text-xs text-amber-600 mt-1">Balance due: ${(payFor.service.price - parseFloat(payAmount || "0")).toFixed(2)}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPayFor(null)}>Cancel</Button>
              <Button className="flex-1" onClick={confirmComplete}
                disabled={payMode === "PARTIAL" && (!payAmount || parseFloat(payAmount) <= 0)}>
                Complete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
