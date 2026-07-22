"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  format, addDays, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isSameDay, isSameMonth, isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Phone, X, Trash2 } from "lucide-react";
import NewAppointmentModal from "@/components/admin/new-appointment-modal";
import PaymentBadge from "@/components/payment-badge";

interface Appointment {
  id: string;
  clientId: string;
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
  staff: { id: string; name: string; color: string } | null;
}

interface StaffMember { id: string; name: string; color: string; overbook?: boolean; parentId?: string | null; }
interface DayOff { date: string; allStaff: boolean; reason: string | null; }

const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  CONFIRMED: "success",
  PENDING: "warning",
  CANCELLED: "destructive",
  COMPLETED: "success",
  NO_SHOW: "destructive",
};

const OPEN = 9;   // salon opens
const CLOSE = 18; // salon closes

function hourLabel(h: number) {
  return `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
}

function payTag(a: Appointment): string {
  if (a.status !== "COMPLETED") return "";
  if (a.clientPackageId) return "Package";
  if (a.paymentStatus === "PAID") return "Paid";
  if (a.paymentStatus === "PARTIAL") return `Partial $${a.amountPaid ?? 0}`;
  if (a.paymentStatus === "UNPAID") return "Unpaid";
  return "";
}

const isDead = (a: Appointment) => a.status === "CANCELLED" || a.status === "NO_SHOW";
const blockColor = (a: Appointment) =>
  a.status === "CANCELLED" ? "#9ca3af" : a.staff?.color || "#9ca3af";
const statusMark = (a: Appointment) =>
  a.status === "COMPLETED" ? "✓ " : a.status === "NO_SHOW" ? "✗ " : a.status === "CANCELLED" ? "⊘ " : "";

export default function AppointmentsPage() {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [prefill, setPrefill] = useState<{ date: string; time: string; staffId?: string } | null>(null);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [payFor, setPayFor] = useState<Appointment | null>(null);
  const [payMode, setPayMode] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [payAmount, setPayAmount] = useState("");
  const [now, setNow] = useState(new Date());
  const [role, setRole] = useState("STAFF");
  const isAdmin = role === "ADMIN";
  // "Still to do" — work the client left unfinished
  const [todoFor, setTodoFor] = useState<Appointment | null>(null);
  const [todoText, setTodoText] = useState("");
  const [payTodo, setPayTodo] = useState("");

  // Day view is tighter — good default on phones
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setView("day");
  }, []);

  const HOUR_PX = 88;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor, { weekStartsOn: 1 }), i));
  const monthGridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const monthDays = Array.from(
    { length: Math.round((monthGridEnd.getTime() - monthGridStart.getTime()) / 86400000) + 1 },
    (_, i) => addDays(monthGridStart, i)
  );

  const rangeStart = view === "day" ? anchor : view === "week" ? weekDays[0] : monthGridStart;
  const rangeEnd = view === "day" ? anchor : view === "week" ? weekDays[6] : monthGridEnd;
  const rangeKey = `${format(rangeStart, "yyyy-MM-dd")}_${format(rangeEnd, "yyyy-MM-dd")}`;

  async function load() {
    try {
      const res = await fetch(`/api/appointments?from=${format(rangeStart, "yyyy-MM-dd")}&to=${format(rangeEnd, "yyyy-MM-dd")}`);
      const data = res.ok ? await res.json().catch(() => []) : [];
      setAppointments(Array.isArray(data) ? data : []);
    } catch {
      setAppointments([]);
    }
  }

  // Staff drives the calendar columns — retry briefly so a hiccup doesn't
  // leave the day view without its technician columns
  async function loadStaff(attempt = 0) {
    try {
      const res = await fetch("/api/staff");
      if (!res.ok) throw new Error("staff fetch failed");
      const d = await res.json();
      setStaffList(Array.isArray(d) ? d : []);
    } catch {
      if (attempt < 3) setTimeout(() => loadStaff(attempt + 1), 1000 * (attempt + 1));
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [rangeKey]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    loadStaff();
    fetch("/api/auth/me").then((r) => r.json()).then((u) => { if (u?.role) setRole(u.role); }).catch(() => {});
    fetch("/api/daysoff").then((r) => (r.ok ? r.json() : [])).then((d) => setDaysOff(Array.isArray(d) ? d : [])).catch(() => {});
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setDetail(null);
    load();
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this appointment? It stays on the calendar marked as cancelled.")) return;
    await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    setDetail(null);
    load();
  }

  function startComplete(appt: Appointment) {
    if (appt.clientPackageId || !appt.service.price) { updateStatus(appt.id, "COMPLETED"); return; }
    setPayMode("PAID"); setPayAmount(""); setPayFor(appt);
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
    if (payTodo.trim()) await saveTodo(payFor, payTodo);
    setPayTodo("");
    setPayFor(null);
    load();
  }

  // Record what the client still has left from this visit
  async function saveTodo(a: Appointment, text: string) {
    const clientId = a.clientId;
    if (!clientId) return;
    await fetch(`/api/clients/${clientId}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: text.trim(), fromService: a.service.name, appointmentId: a.id }),
    }).catch(() => {});
  }

  async function submitTodo() {
    if (!todoFor || !todoText.trim()) return;
    await saveTodo(todoFor, todoText);
    setTodoText("");
    setTodoFor(null);
    setDetail(null);
  }

  // Admin only: wipe the record entirely, whatever its status
  async function removeAppointment(a: Appointment) {
    if (!confirm(`Permanently delete ${a.client.name}'s ${a.service.name} appointment?\n\nThis removes it from the calendar for good and cannot be undone.`)) return;
    const res = await fetch(`/api/appointments/${a.id}?hard=1`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Could not delete the appointment");
      return;
    }
    setDetail(null);
    load();
  }

  // Day view = one column per technician; her helper slot shares the column
  const lanes = staffList.filter((s) => !s.parentId);
  const laneCount = Math.max(lanes.length, 1);
  const laneIndexOf = new Map<string, number>();
  staffList.forEach((s) => laneIndexOf.set(s.id, lanes.findIndex((l) => l.id === (s.parentId || s.id))));

  const cancelledCount = appointments.filter((a) => a.status === "CANCELLED").length;
  const isClosed = (day: Date) =>
    daysOff.some((d) => d.allStaff && isSameDay(new Date(d.date), day));

  const dayAppts = (day: Date) =>
    appointments
      .filter((a) => isSameDay(new Date(a.startTime), day))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  function packOverlaps(list: Appointment[]) {
    const laneEnds: number[] = [];
    const placed = list.map((a) => {
      const s = new Date(a.startTime).getTime();
      const e = new Date(a.endTime).getTime();
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane === -1) { laneEnds.push(e); lane = laneEnds.length - 1; }
      else laneEnds[lane] = e;
      return { a, lane };
    });
    return { placed, count: Math.max(laneEnds.length, 1) };
  }

  function dayLayout(list: Appointment[]) {
    const byLane = new Map<number, Appointment[]>();
    for (const a of list) {
      const idx = a.staff ? (laneIndexOf.get(a.staff.id) ?? -1) : -1;
      if (!byLane.has(idx)) byLane.set(idx, []);
      byLane.get(idx)!.push(a);
    }
    const map = new Map<string, { laneIdx: number; sub: number; subCount: number }>();
    for (const [laneIdx, appts] of byLane) {
      const { placed, count } = packOverlaps(appts);
      for (const { a, lane } of placed) map.set(a.id, { laneIdx, sub: lane, subCount: count });
    }
    return map;
  }

  function timeFromClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const mins = OPEN * 60 + Math.floor(((y / HOUR_PX) * 60) / 30) * 30;
    const clamped = Math.min(Math.max(mins, OPEN * 60), CLOSE * 60 - 30);
    return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
  }

  function dayGridClick(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    const time = timeFromClick(e);
    let staffId: string | undefined;
    if (lanes.length) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const idx = Math.min(Math.floor((x / rect.width) * laneCount), laneCount - 1);
      staffId = lanes[idx]?.id;
    }
    setPrefill({ date: format(day, "yyyy-MM-dd"), time, staffId });
    setShowNew(true);
  }

  function newOn(day: Date) {
    setPrefill({ date: format(day, "yyyy-MM-dd"), time: "" });
    setShowNew(true);
  }

  function shiftNav(dir: number) {
    if (view === "month") setAnchor(addMonths(anchor, dir));
    else setAnchor(addDays(anchor, dir * (view === "day" ? 1 : 7)));
  }

  const dateLabel =
    view === "day" ? format(anchor, "EEEE, MMM d, yyyy")
    : view === "week" ? `${format(weekDays[0], "d MMM")} – ${format(weekDays[6], "d MMM yyyy")}`
    : format(anchor, "MMMM yyyy");

  const hours = Array.from({ length: CLOSE - OPEN + 1 }, (_, i) => OPEN + i);
  const gridHeight = (CLOSE - OPEN) * HOUR_PX;
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) - OPEN * 60) / 60 * HOUR_PX;
  const nowVisible = now.getHours() >= OPEN && now.getHours() < CLOSE;

  // Compact chip used by the week cards and month grid
  const Chip = ({ a }: { a: Appointment }) => (
    <button type="button"
      onClick={(e) => { e.stopPropagation(); setDetail(a); }}
      className={`w-full text-left px-1.5 py-1 rounded border-l-[3px] bg-gray-50 hover:bg-gray-100 transition-colors ${isDead(a) ? "opacity-60" : ""}`}
      style={{ borderLeftColor: blockColor(a) }}>
      <p className={`text-[11px] leading-tight truncate ${a.status === "CANCELLED" ? "line-through text-gray-500" : "text-gray-900"}`}>
        <span className="font-semibold">{format(new Date(a.startTime), "h:mm")}</span> {statusMark(a)}{a.client.name}
      </p>
    </button>
  );

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4 flex flex-col h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Appointments</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {cancelledCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500" /> {cancelledCount} Cancelled
            </span>
          )}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["day", "week", "month"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${view === v ? "bg-pink-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => shiftNav(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => shiftNav(1)}><ChevronRight className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>Today</Button>
          </div>
          <Button size="sm" onClick={() => { setPrefill(null); setShowNew(true); }}>
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-700 -mt-1">{dateLabel}</p>

      {/* ── DAY: time grid split by technician ───────────────────────── */}
      {view === "day" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-auto flex-1">
          <div>
            <div className="grid border-b border-gray-200 sticky top-0 bg-white z-20"
              style={{ gridTemplateColumns: "48px 1fr" }}>
              <div />
              <div className="pt-2 text-center border-l border-gray-100">
                <p className="text-[11px] text-gray-500">{format(anchor, "EEE")}</p>
                <p className={`text-base font-semibold w-8 h-8 mx-auto flex items-center justify-center rounded-full ${isToday(anchor) ? "bg-pink-600 text-white" : "text-gray-900"}`}>
                  {format(anchor, "d")}
                </p>
                {lanes.length > 0 && (
                  <div className="flex border-t border-gray-100 mt-1">
                    {lanes.map((s) => (
                      <div key={s.id} className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 border-l border-gray-200 first:border-l-0">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
                          style={{ backgroundColor: s.color }}>
                          {s.name.charAt(0)}
                        </span>
                        <span className="text-[11px] font-medium text-gray-600 truncate">{s.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: "48px 1fr" }}>
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((h) => (
                  <span key={h} className="absolute right-1.5 text-[10px] text-gray-400 leading-none"
                    style={{ top: Math.max((h - OPEN) * HOUR_PX - 4, 0) }}>
                    {hourLabel(h)}
                  </span>
                ))}
              </div>

              {(() => {
                const list = dayAppts(anchor);
                const dayPos = dayLayout(list);
                return (
                  <div className="relative border-l border-gray-100 cursor-pointer"
                    style={{ height: gridHeight }}
                    onClick={(e) => dayGridClick(anchor, e)}>
                    {hours.slice(0, -1).map((h) => (
                      <div key={h}>
                        <div className="absolute left-0 right-0 border-t border-gray-100" style={{ top: (h - OPEN) * HOUR_PX }} />
                        <div className="absolute left-0 right-0 border-t border-gray-50" style={{ top: (h - OPEN) * HOUR_PX + HOUR_PX / 2 }} />
                      </div>
                    ))}
                    {laneCount > 1 && lanes.slice(1).map((s, i) => (
                      <div key={s.id} className="absolute top-0 bottom-0 pointer-events-none border-l border-gray-200"
                        style={{ left: `${((i + 1) * 100) / laneCount}%` }} />
                    ))}
                    {isToday(anchor) && nowVisible && (
                      <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowTop }}>
                        <div className="border-t-2 border-red-500 relative">
                          <div className="w-2.5 h-2.5 bg-red-500 rounded-full absolute -left-1 -top-[6px]" />
                        </div>
                      </div>
                    )}
                    {list.map((a) => {
                      const s = new Date(a.startTime);
                      const e = new Date(a.endTime);
                      const top = ((s.getHours() * 60 + s.getMinutes()) - OPEN * 60) / 60 * HOUR_PX;
                      const height = Math.max(((e.getTime() - s.getTime()) / 60000 / 60) * HOUR_PX, 30);
                      let leftStyle = "2px";
                      let widthCalc = "calc(100% - 4px)";
                      const pos = dayPos.get(a.id);
                      if (pos) {
                        const laneW = pos.laneIdx >= 0 ? 100 / laneCount : 100;
                        const laneLeft = pos.laneIdx >= 0 ? pos.laneIdx * laneW : 0;
                        const subW = laneW / pos.subCount;
                        leftStyle = `calc(${laneLeft + pos.sub * subW}% + 2px)`;
                        widthCalc = `calc(${subW}% - 3px)`;
                      }
                      const tag = payTag(a);
                      const showService = height >= 40;
                      const showMeta = height >= 60;
                      return (
                        <button key={a.id} type="button"
                          onClick={(ev) => { ev.stopPropagation(); setDetail(a); }}
                          className={`absolute rounded-md px-1.5 py-1 text-left overflow-hidden text-white shadow-sm hover:shadow-md hover:z-10 transition-shadow ${isDead(a) ? "opacity-70" : ""}`}
                          style={{ top, height, left: leftStyle, width: widthCalc, backgroundColor: blockColor(a) }}>
                          <p className={`text-[11px] font-semibold leading-tight truncate ${a.status === "CANCELLED" ? "line-through" : ""}`}>
                            {statusMark(a)}{a.client.name}
                          </p>
                          <p className="text-[10px] leading-tight truncate opacity-90">
                            {format(s, "h:mm")}{showService ? ` · ${a.service.name}` : ""}
                          </p>
                          {showMeta && (
                            <p className="text-[10px] leading-tight truncate opacity-80 mt-0.5">
                              {a.staff?.name || "Any staff"}{tag ? ` · ${tag}` : a.service.price ? ` · $${a.service.price}` : ""}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── WEEK: one card per day ───────────────────────────────────── */}
      {view === "week" && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {weekDays.map((day) => {
            const list = dayAppts(day);
            const closed = isClosed(day);
            const booked = list.filter((a) => a.status !== "CANCELLED").length;
            return (
              <div key={day.toISOString()}
                className={`bg-white border rounded-xl p-3 min-h-[190px] flex flex-col ${isToday(day) ? "border-pink-400 ring-1 ring-pink-200" : "border-gray-200"}`}>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold text-gray-900">{format(day, "EEE d")}</p>
                  <button onClick={() => newOn(day)} className="text-gray-300 hover:text-pink-600" title="New appointment">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className={`text-xs mb-2 ${closed ? "text-red-500 font-medium" : "text-gray-500"}`}>
                  {closed ? "Closed" : `${booked} booking${booked !== 1 ? "s" : ""}`}
                </p>
                <div className="space-y-1 flex-1 overflow-y-auto">
                  {list.map((a) => <Chip key={a.id} a={a} />)}
                  {!closed && list.length === 0 && (
                    <button onClick={() => newOn(day)}
                      className="w-full h-full min-h-[80px] rounded-lg border border-dashed border-gray-200 text-xs text-gray-300 hover:border-pink-300 hover:text-pink-500 transition-colors">
                      —
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MONTH: calendar grid ─────────────────────────────────────── */}
      {view === "month" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const list = dayAppts(day);
              const inMonth = isSameMonth(day, anchor);
              const closed = isClosed(day);
              const shown = list.slice(0, 3);
              return (
                <div key={day.toISOString()}
                  onClick={() => { setAnchor(day); setView("day"); }}
                  className={`min-h-[104px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors hover:bg-pink-50/40 ${inMonth ? "" : "bg-gray-50/60"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday(day) ? "bg-pink-600 text-white font-semibold" : inMonth ? "text-gray-900" : "text-gray-400"}`}>
                      {format(day, "d")}
                    </span>
                    {list.length > 0 && (
                      <span className="text-[10px] text-gray-400 font-medium">{list.length}</span>
                    )}
                  </div>
                  {closed ? (
                    <p className="text-[10px] text-red-500 px-1">Closed</p>
                  ) : (
                    <div className="space-y-0.5">
                      {shown.map((a) => <Chip key={a.id} a={a} />)}
                      {list.length > 3 && (
                        <p className="text-[10px] text-gray-400 pl-1">+{list.length - 3} more</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showNew && (
        <NewAppointmentModal
          initialDate={prefill?.date}
          initialTime={prefill?.time || undefined}
          initialStaffId={prefill?.staffId}
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
              <div className="flex gap-1.5 pt-1 flex-wrap">
                <Badge variant={statusColors[detail.status] || "outline"}>{detail.status}</Badge>
                {detail.clientPackageId ? (
                  <Badge variant="default">📦 Package session — paid via package</Badge>
                ) : (
                  <PaymentBadge status={detail.paymentStatus} amountPaid={detail.amountPaid} price={detail.service.price} />
                )}
                <Badge variant="outline">{detail.source}</Badge>
              </div>
            </div>

            {/* Record something the client left unfinished */}
            {todoFor?.id === detail.id ? (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-medium text-amber-900">What is still to do for {detail.client.name}?</p>
                <Input autoFocus value={todoText} onChange={(e) => setTodoText(e.target.value)}
                  placeholder="e.g. legs" className="bg-white"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitTodo(); } }} />
                <p className="text-xs text-amber-700">
                  It will show every time someone books {detail.client.name}, until it is marked done.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setTodoFor(null); setTodoText(""); }}>Cancel</Button>
                  <Button size="sm" className="flex-1" onClick={submitTodo} disabled={!todoText.trim()}>Save</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => { setTodoFor(detail); setTodoText(""); }}>
                ⚠ Something still to do
              </Button>
            )}

            {/* Status actions — available whatever the current status */}
            <div className="space-y-2">
              <div className="flex gap-2">
                {detail.status !== "COMPLETED" && (
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => { const a = detail; setDetail(null); startComplete(a); }}>Done</Button>
                )}
                {detail.status !== "NO_SHOW" && (
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => updateStatus(detail.id, "NO_SHOW")}>No-show</Button>
                )}
                {detail.status !== "CANCELLED" ? (
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => cancel(detail.id)}>Cancel</Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStatus(detail.id, "CONFIRMED")}>Restore</Button>
                )}
              </div>
              {isAdmin && (
                <div className="border-t border-gray-100 pt-2">
                  <Button size="sm" variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => removeAppointment(detail)}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete appointment
                  </Button>
                </div>
              )}
            </div>
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
            {/* Anything the client did not finish today */}
            <div className="border-t border-gray-100 pt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anything still to do? <span className="font-normal text-gray-400">(leave empty if all done)</span>
              </label>
              <Input value={payTodo} onChange={(e) => setPayTodo(e.target.value)} placeholder="e.g. legs" />
              {payTodo.trim() && (
                <p className="text-xs text-amber-600 mt-1">
                  Will be shown whenever {payFor.client.name} is booked, until marked done.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setPayFor(null); setPayTodo(""); }}>Cancel</Button>
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
