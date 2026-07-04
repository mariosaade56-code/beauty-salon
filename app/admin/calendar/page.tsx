"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { format } from "date-fns";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

interface Staff { id: string; name: string; color: string; }
interface DayOff { id: string; date: string; reason: string | null; allStaff: boolean; staff: Staff | null; }
interface Break { id: string; staffId: string; startTime: string; endTime: string; label: string | null; dayOfWeek: number | null; staff: Staff; }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarControlPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [dayOffForm, setDayOffForm] = useState({ date: "", reason: "", staffId: "", allStaff: true });
  const [breakForm, setBreakForm] = useState({ staffId: "", startTime: "", endTime: "", label: "", dayOfWeek: "" });

  async function load() {
    const [s, d, b] = await Promise.all([
      fetch("/api/staff").then((r) => r.json()),
      fetch("/api/daysoff").then((r) => r.json()),
      fetch("/api/breaks").then((r) => r.json()),
    ]);
    setStaff(s); setDaysOff(d); setBreaks(b);
  }

  useEffect(() => { load(); }, []);

  async function addDayOff(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/daysoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dayOffForm.date,
        reason: dayOffForm.reason || null,
        allStaff: dayOffForm.allStaff,
        staffId: dayOffForm.allStaff ? null : dayOffForm.staffId,
      }),
    });
    setDayOffForm({ date: "", reason: "", staffId: "", allStaff: true });
    load();
  }

  async function deleteDayOff(id: string) {
    await fetch("/api/daysoff", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  async function addBreak(e: React.FormEvent) {
    e.preventDefault();
    const baseDate = "2000-01-01";
    await fetch("/api/breaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffId: breakForm.staffId,
        startTime: `${baseDate}T${breakForm.startTime}:00`,
        endTime: `${baseDate}T${breakForm.endTime}:00`,
        label: breakForm.label || null,
        dayOfWeek: breakForm.dayOfWeek ? parseInt(breakForm.dayOfWeek) : null,
      }),
    });
    setBreakForm({ staffId: "", startTime: "", endTime: "", label: "", dayOfWeek: "" });
    load();
  }

  async function deleteBreak(id: string) {
    await fetch("/api/breaks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar Control</h1>
        <p className="text-sm text-gray-500 mt-1">Close days, add breaks, and manage availability</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Days Off */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-yellow-500" />Close a Day</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={addDayOff} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <Input type="date" required value={dayOffForm.date} onChange={(e) => setDayOffForm({ ...dayOffForm, date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applies to</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={dayOffForm.allStaff} onChange={() => setDayOffForm({ ...dayOffForm, allStaff: true })} />
                    Whole salon
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" checked={!dayOffForm.allStaff} onChange={() => setDayOffForm({ ...dayOffForm, allStaff: false })} />
                    One staff member
                  </label>
                </div>
              </div>
              {!dayOffForm.allStaff && (
                <Select value={dayOffForm.staffId} onChange={(e) => setDayOffForm({ ...dayOffForm, staffId: e.target.value })} required={!dayOffForm.allStaff}>
                  <option value="">Select staff</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <Input value={dayOffForm.reason} onChange={(e) => setDayOffForm({ ...dayOffForm, reason: e.target.value })} placeholder="e.g. Holiday, renovation..." />
              </div>
              <Button type="submit" size="sm"><Plus className="w-4 h-4 mr-1" /> Close Day</Button>
            </form>

            <div className="space-y-2 pt-2">
              {daysOff.length === 0 && <p className="text-sm text-gray-400">No days closed</p>}
              {daysOff.map((d) => (
                <div key={d.id} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{format(new Date(d.date), "EEE, MMM d, yyyy")}</p>
                    <p className="text-xs text-gray-500">{d.allStaff ? "Whole salon" : d.staff?.name} {d.reason ? `· ${d.reason}` : ""}</p>
                  </div>
                  <button onClick={() => deleteDayOff(d.id)}><Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" /></button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Breaks */}
        <Card>
          <CardHeader><CardTitle>Staff Breaks</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={addBreak} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff *</label>
                <Select required value={breakForm.staffId} onChange={(e) => setBreakForm({ ...breakForm, staffId: e.target.value })}>
                  <option value="">Select staff</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From *</label>
                  <Input type="time" required value={breakForm.startTime} onChange={(e) => setBreakForm({ ...breakForm, startTime: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To *</label>
                  <Input type="time" required value={breakForm.endTime} onChange={(e) => setBreakForm({ ...breakForm, endTime: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recurring day (optional)</label>
                <Select value={breakForm.dayOfWeek} onChange={(e) => setBreakForm({ ...breakForm, dayOfWeek: e.target.value })}>
                  <option value="">One-time / specific date</option>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <Input value={breakForm.label} onChange={(e) => setBreakForm({ ...breakForm, label: e.target.value })} placeholder="e.g. Lunch break" />
              </div>
              <Button type="submit" size="sm"><Plus className="w-4 h-4 mr-1" /> Add Break</Button>
            </form>

            <div className="space-y-2 pt-2">
              {breaks.length === 0 && <p className="text-sm text-gray-400">No breaks added</p>}
              {breaks.map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{b.staff.name} · {format(new Date(b.startTime), "h:mm a")} – {format(new Date(b.endTime), "h:mm a")}</p>
                    <p className="text-xs text-gray-500">{b.dayOfWeek !== null ? `Every ${DAYS[b.dayOfWeek]}` : "Specific date"} {b.label ? `· ${b.label}` : ""}</p>
                  </div>
                  <button onClick={() => deleteBreak(b.id)}><Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" /></button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
