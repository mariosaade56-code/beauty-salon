"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Phone } from "lucide-react";
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

export default function AppointmentsPage() {
  const [date, setDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [payFor, setPayFor] = useState<Appointment | null>(null);
  const [payMode, setPayMode] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [payAmount, setPayAmount] = useState("");

  async function load(d: Date) {
    const data = await fetch(`/api/appointments?date=${format(d, "yyyy-MM-dd")}`).then((r) => r.json());
    setAppointments(Array.isArray(data) ? data : []);
  }

  useEffect(() => { load(date); }, [date]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load(date);
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
    load(date);
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    load(date);
  }

  const active = appointments.filter((a) => a.status !== "CANCELLED");

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500 text-sm mt-1">{active.length} appointment{active.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setDate(subDays(date, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="font-semibold text-gray-900 flex-1 text-center text-sm md:text-base">
          {format(date, "EEE, MMM d, yyyy")}
        </div>
        <Button variant="outline" size="sm" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDate(new Date())}>Today</Button>
      </div>

      {/* Mobile: card list / Desktop: table */}
      {active.length === 0 ? (
        <Card><CardContent><p className="text-center text-gray-400 py-16">No appointments for this day</p></CardContent></Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {active.map((appt) => (
              <Card key={appt.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{format(new Date(appt.startTime), "h:mm a")}</p>
                      <p className="text-xs text-gray-500">{appt.service.duration}min</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={statusColors[appt.status] || "outline"}>{appt.status}</Badge>
                      <PaymentBadge status={appt.paymentStatus} amountPaid={appt.amountPaid} price={appt.service.price} />
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900">{appt.client.name}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{appt.client.phone}</p>
                  <p className="text-sm text-gray-700 mt-1">{appt.service.name}</p>
                  {appt.staff && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: appt.staff.color }} />
                      <span className="text-sm text-gray-700">{appt.staff.name}</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    {appt.status === "CONFIRMED" && (
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => startComplete(appt)}>Done</Button>
                    )}
                    {appt.status === "CONFIRMED" && (
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => updateStatus(appt.id, "NO_SHOW")}>No-show</Button>
                    )}
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => cancel(appt.id)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Service</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Staff</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {active.map((appt) => (
                    <tr key={appt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900">{format(new Date(appt.startTime), "h:mm a")}</p>
                        <span className="text-gray-500 text-xs">{appt.service.duration}min</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{appt.client.name}</p>
                        <p className="text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {appt.client.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{appt.service.name}</p>
                        {appt.service.price && <p className="text-gray-500 text-xs">${appt.service.price}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {appt.staff ? (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: appt.staff.color }} />
                            <span className="font-medium text-gray-900">{appt.staff.name}</span>
                          </div>
                        ) : <span className="text-gray-400">Any</span>}
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline">{appt.source}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant={statusColors[appt.status] || "outline"}>{appt.status}</Badge>
                          <PaymentBadge status={appt.paymentStatus} amountPaid={appt.amountPaid} price={appt.service.price} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {appt.status === "CONFIRMED" && <Button size="sm" variant="secondary" onClick={() => startComplete(appt)}>Done</Button>}
                          {appt.status === "CONFIRMED" && <Button size="sm" variant="secondary" onClick={() => updateStatus(appt.id, "NO_SHOW")}>No-show</Button>}
                          <Button size="sm" variant="destructive" onClick={() => cancel(appt.id)}>Cancel</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}


      {showNew && <NewAppointmentModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(date); }} />}

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
