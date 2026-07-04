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

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
  notes: string | null;
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

  async function load(d: Date) {
    const data = await fetch(`/api/appointments?date=${format(d, "yyyy-MM-dd")}`).then((r) => r.json());
    setAppointments(data);
  }

  useEffect(() => { load(date); }, [date]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load(date);
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    load(date);
  }

  const active = appointments.filter((a) => a.status !== "CANCELLED");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500 text-sm mt-1">{active.length} appointment{active.length !== 1 ? "s" : ""} today</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Appointment
        </Button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setDate(subDays(date, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="font-semibold text-gray-900 min-w-[200px] text-center">
          {format(date, "EEEE, MMMM d, yyyy")}
        </div>
        <Button variant="outline" size="sm" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDate(new Date())}>Today</Button>
      </div>

      {/* Appointment list */}
      <Card>
        <CardContent className="p-0">
          {active.length === 0 ? (
            <p className="text-center text-gray-400 py-16">No appointments for this day</p>
          ) : (
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
                    <td className="px-4 py-3 font-medium">
                      {format(new Date(appt.startTime), "h:mm a")}
                      <span className="text-gray-400 text-xs block">{appt.service.duration}min</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{appt.client.name}</p>
                      <p className="text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {appt.client.phone}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{appt.service.name}</p>
                      {appt.service.price && <p className="text-gray-400">${appt.service.price}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {appt.staff ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: appt.staff.color }} />
                          {appt.staff.name}
                        </div>
                      ) : <span className="text-gray-400">Any</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{appt.source}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusColors[appt.status] || "outline"}>{appt.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {appt.status === "CONFIRMED" && (
                          <Button size="sm" variant="secondary" onClick={() => updateStatus(appt.id, "COMPLETED")}>
                            Done
                          </Button>
                        )}
                        {appt.status === "CONFIRMED" && (
                          <Button size="sm" variant="secondary" onClick={() => updateStatus(appt.id, "NO_SHOW")}>
                            No-show
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => cancel(appt.id)}>Cancel</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {showNew && <NewAppointmentModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(date); }} />}
    </div>
  );
}
