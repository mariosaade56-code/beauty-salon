"use client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { format } from "date-fns";
import { X, UserCheck } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreated: () => void;
  initialDate?: string; // yyyy-MM-dd — from clicking a calendar slot
  initialTime?: string; // HH:mm
  initialStaffId?: string; // clicked technician's column
}

interface ClientSuggestion {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  _count: { appointments: number };
}

export default function NewAppointmentModal({ onClose, onCreated, initialDate, initialTime, initialStaffId }: Props) {
  const [services, setServices] = useState<{ id: string; name: string; duration: number }[]>([]);
  const [packages, setPackages] = useState<{ id: string; name: string; serviceId: string; sessionCount: number; price: number; isActive: boolean }[]>([]);
  const [packageId, setPackageId] = useState("");
  const [pkgInfo, setPkgInfo] = useState<{ remaining: number; total: number } | null>(null);
  const [unpaid, setUnpaid] = useState<number | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [slots, setSlots] = useState<{ time: string; staffId: string; staffName: string }[]>([]);
  const [form, setForm] = useState({
    clientName: "", phone: "", email: "",
    serviceId: "", staffId: initialStaffId || "", date: initialDate || format(new Date(), "yyyy-MM-dd"), time: "", notes: "",
  });
  const appliedInitialTime = useRef(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [suggestFor, setSuggestFor] = useState<"name" | "phone" | null>(null);
  const [linkedClient, setLinkedClient] = useState<ClientSuggestion | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function searchClients(query: string, field: "name" | "phone") {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setSuggestFor(null);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const data = await fetch(`/api/clients?search=${encodeURIComponent(query.trim())}`).then((r) => r.json());
      setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []);
      setSuggestFor(field);
    }, 250);
  }

  function pickClient(c: ClientSuggestion) {
    setForm({ ...form, clientName: c.name, phone: c.phone, email: c.email || "" });
    setLinkedClient(c);
    setSuggestions([]);
    setSuggestFor(null);
  }

  // A package booking uses its underlying service for availability
  const selectedPackage = packageId ? packages.find((p) => p.id === packageId) || null : null;
  const effectiveServiceId = selectedPackage ? selectedPackage.serviceId : form.serviceId;

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then(setServices);
    fetch("/api/packages").then((r) => r.json()).then((d) => setPackages(Array.isArray(d) ? d.filter((p) => p.isActive) : []));
    fetch("/api/staff").then((r) => r.json()).then(setStaff);
  }, []);

  useEffect(() => {
    if (effectiveServiceId && form.date) {
      const params = new URLSearchParams({ serviceId: effectiveServiceId, date: form.date });
      if (form.staffId) params.set("staffId", form.staffId);
      fetch(`/api/availability?${params}`).then((r) => r.json()).then((d) => setSlots(Array.isArray(d) ? d : []));
    }
  }, [effectiveServiceId, form.date, form.staffId]);

  // Preselect the clicked calendar slot once availability arrives
  useEffect(() => {
    if (initialTime && !appliedInitialTime.current && slots.some((s) => s.time === initialTime)) {
      appliedInitialTime.current = true;
      setForm((f) => ({ ...f, time: initialTime }));
    }
  }, [slots, initialTime]);

  // With a known client + package chosen: show her remaining sessions and unpaid balance
  useEffect(() => {
    setPkgInfo(null);
    setUnpaid(null);
    if (!linkedClient || !packageId) return;
    fetch(`/api/clients/${linkedClient.id}/packages`)
      .then((r) => (r.ok ? r.json() : []))
      .then((cps) => {
        const now = Date.now();
        const mine = (Array.isArray(cps) ? cps : []).filter(
          (cp) => cp.packageId === packageId && (!cp.expiresAt || new Date(cp.expiresAt).getTime() > now)
        );
        const remaining = mine.reduce((s, cp) => s + Math.max(cp.sessionsTotal - cp.sessionsUsed, 0), 0);
        const total = mine.reduce((s, cp) => s + cp.sessionsTotal, 0);
        setPkgInfo({ remaining, total });
      })
      .catch(() => {});
    fetch(`/api/clients/${linkedClient.id}/transactions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((txs) => {
        if (!Array.isArray(txs)) return;
        setUnpaid(txs.filter((t) => !t.paid).reduce((s, t) => s + t.amount, 0));
      })
      .catch(() => {});
  }, [linkedClient, packageId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.time) return alert("Please select a time slot");
    setLoading(true);
    const slot = slots.find((s) => s.time === form.time);
    await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: form.clientName,
        phone: form.phone,
        email: form.email,
        serviceId: effectiveServiceId,
        packageId: selectedPackage?.id || null,
        staffId: slot?.staffId || form.staffId || null,
        startTime: `${form.date}T${form.time}:00`,
        notes: form.notes,
        source: "MANUAL",
      }),
    });
    setLoading(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">New Appointment</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <Input required value={form.clientName} autoComplete="off"
                onChange={(e) => {
                  setForm({ ...form, clientName: e.target.value });
                  setLinkedClient(null);
                  searchClients(e.target.value, "name");
                }} />
              {suggestFor === "name" && suggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map((c) => (
                    <button key={c.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-pink-50 transition-colors"
                      onClick={() => pickClient(c)}>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone} · {c._count.appointments} visit{c._count.appointments !== 1 ? "s" : ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <Input required value={form.phone} autoComplete="off"
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  setLinkedClient(null);
                  searchClients(e.target.value, "phone");
                }} />
              {suggestFor === "phone" && suggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map((c) => (
                    <button key={c.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-pink-50 transition-colors"
                      onClick={() => pickClient(c)}>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone} · {c._count.appointments} visit{c._count.appointments !== 1 ? "s" : ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {linkedClient && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" /> Existing client — booking will be added to {linkedClient.name}&apos;s file
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service {!packageId && "*"}</label>
              <Select required={!packageId} value={form.serviceId} disabled={!!packageId}
                onChange={(e) => { setForm({ ...form, serviceId: e.target.value, time: "" }); setPackageId(""); }}>
                <option value="">{packageId ? "— using package —" : "Select service"}</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Package</label>
              <Select value={packageId}
                onChange={(e) => { setPackageId(e.target.value); setForm({ ...form, serviceId: "", time: "" }); }}>
                <option value="">— None —</option>
                {packages.map((p) => <option key={p.id} value={p.id}>📦 {p.name} ({p.sessionCount} sessions · ${p.price})</option>)}
              </Select>
            </div>
          </div>

          {/* Client package status */}
          {selectedPackage && (
            <div className="rounded-lg border px-3 py-2.5 text-sm space-y-1 bg-gray-50 border-gray-200">
              {!linkedClient ? (
                <p className="text-gray-500 text-xs">Pick an existing client above (type their name or phone) to see their remaining sessions.</p>
              ) : pkgInfo === null ? (
                <p className="text-gray-400 text-xs">Checking {linkedClient.name}&apos;s package…</p>
              ) : pkgInfo.remaining > 0 ? (
                <p className="text-green-700 text-xs font-medium">
                  ✓ {linkedClient.name} has {pkgInfo.remaining} of {pkgInfo.total} sessions left — this booking uses 1 (then {pkgInfo.remaining - 1} left)
                </p>
              ) : (
                <p className="text-amber-700 text-xs font-medium">
                  ⚠ {linkedClient.name} has no active {selectedPackage.name} — a new package (${selectedPackage.price}) will be assigned with this booking
                </p>
              )}
              {linkedClient && unpaid !== null && unpaid > 0 && (
                <p className="text-red-600 text-xs font-medium">Pending payment: ${unpaid.toFixed(2)} unpaid balance on {linkedClient.name}&apos;s account</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff (optional)</label>
            <Select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value, time: "" })}>
              <option value="">Any available</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, time: "" })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
              <Select required value={form.time} disabled={!effectiveServiceId}
                onChange={(e) => setForm({ ...form, time: e.target.value })}>
                <option value="">
                  {!effectiveServiceId ? "Select service or package first" : slots.length === 0 ? "No times available" : "Select time"}
                </option>
                {slots.map((slot) => (
                  <option key={`${slot.time}-${slot.staffId}`} value={slot.time}>
                    {format(new Date(`2000-01-01T${slot.time}:00`), "h:mm a")}
                    {!form.staffId ? ` — ${slot.staffName}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {effectiveServiceId && form.date && slots.length === 0 && (
            <p className="text-sm text-red-500">
              {form.staffId
                ? `${staff.find((s) => s.id === form.staffId)?.name || "This staff member"} is not available on this date — try another date or staff`
                : "No available slots for this date"}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Booking..." : "Book Appointment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
