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
  const [services, setServices] = useState<{ id: string; name: string; duration: number; price: number | null }[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [packages, setPackages] = useState<{ id: string; name: string; serviceId: string; sessionCount: number; price: number; isActive: boolean }[]>([]);
  const [packageId, setPackageId] = useState("");
  const [pkgInfo, setPkgInfo] = useState<{ remaining: number; total: number } | null>(null);
  const [unpaid, setUnpaid] = useState<number | null>(null);
  const [pkgPayMode, setPkgPayMode] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [pkgPayAmount, setPkgPayAmount] = useState("");
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [slots, setSlots] = useState<{ time: string; staffId: string; staffName: string }[]>([]);
  const [slotsError, setSlotsError] = useState(false);
  const [form, setForm] = useState({
    clientName: "", phone: "", email: "",
    staffId: initialStaffId || "", date: initialDate || format(new Date(), "yyyy-MM-dd"), time: "", notes: "",
  });
  const appliedInitialTime = useRef(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [suggestFor, setSuggestFor] = useState<"name" | "phone" | null>(null);
  const [linkedClient, setLinkedClient] = useState<ClientSuggestion | null>(null);
  const [todos, setTodos] = useState<{ id: string; description: string; fromService: string | null; createdAt: string }[]>([]);
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

  // Remind whoever is booking about anything this client left unfinished
  useEffect(() => {
    setTodos([]);
    if (!linkedClient) return;
    fetch(`/api/clients/${linkedClient.id}/pending`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTodos(Array.isArray(d) ? d.filter((x) => !x.doneAt) : []))
      .catch(() => {});
  }, [linkedClient]);

  // A package booking uses its underlying service for availability
  const selectedPackage = packageId ? packages.find((p) => p.id === packageId) || null : null;
  // Services can be stacked: availability needs a slot fitting their combined time
  const bookingServiceIds = selectedPackage ? [selectedPackage.serviceId] : selectedServices;
  const effectiveServiceId = bookingServiceIds[0] || "";
  const chosen = services.filter((s) => selectedServices.includes(s.id));
  const totalDuration = chosen.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = chosen.reduce((sum, s) => sum + (s.price || 0), 0);

  function toggleService(id: string) {
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setPackageId("");
    setForm((f) => ({ ...f, time: "" }));
  }

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then(setServices);
    fetch("/api/packages").then((r) => r.json()).then((d) => setPackages(Array.isArray(d) ? d.filter((p) => p.isActive) : []));
    fetch("/api/staff").then((r) => r.json()).then(setStaff);
  }, []);

  useEffect(() => {
    if (bookingServiceIds.length > 0 && form.date) {
      setSlotsError(false);
      const params = new URLSearchParams({ serviceIds: bookingServiceIds.join(","), date: form.date });
      if (form.staffId) params.set("staffId", form.staffId);
      fetch(`/api/availability?${params}`)
        .then((r) => {
          if (!r.ok) throw new Error("availability failed");
          return r.json();
        })
        .then((d) => setSlots(Array.isArray(d) ? d : []))
        .catch(() => {
          setSlots([]);
          setSlotsError(true);
        });
    } else {
      setSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServices, packageId, form.date, form.staffId]);

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
    if (!selectedPackage && selectedServices.length === 0) return alert("Please choose at least one service");
    if (!form.time) return alert("Please select a time slot");
    setLoading(true);
    const slot = slots.find((s) => s.time === form.time);
    const base = {
      clientName: form.clientName,
      phone: form.phone,
      email: form.email,
      staffId: slot?.staffId || form.staffId || null,
      startTime: `${form.date}T${form.time}:00`,
      notes: form.notes,
      source: "MANUAL",
    };
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selectedPackage
            ? {
                ...base,
                serviceId: selectedPackage.serviceId,
                packageId: selectedPackage.id,
                packagePaymentStatus: pkgPayMode,
                packageAmountPaid: pkgPayMode === "PARTIAL" ? pkgPayAmount : undefined,
              }
            : { ...base, serviceIds: selectedServices }
        ),
      });
      if (!res.ok) {
        alert("Could not book the appointment — please try again.");
        return;
      }
      onCreated();
    } catch {
      alert("Connection problem — the appointment was not booked.");
    } finally {
      setLoading(false);
    }
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
          {/* Anything this client still has left from a previous visit */}
          {todos.length > 0 && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                ⚠ {linkedClient?.name} still has {todos.length === 1 ? "something" : `${todos.length} things`} to do:
              </p>
              <ul className="space-y-0.5">
                {todos.map((t) => (
                  <li key={t.id} className="text-sm text-amber-900">
                    • <span className="font-medium">{t.description}</span>
                    {t.fromService ? <span className="text-amber-700"> — from {t.fromService}, {format(new Date(t.createdAt), "MMM d")}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Services {!packageId && "*"}{" "}
              <span className="font-normal text-gray-400">(tap to pick one or more)</span>
            </label>
            {packageId ? (
              <p className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">— using package —</p>
            ) : (
              <>
                <div className="border border-gray-200 rounded-lg max-h-44 overflow-y-auto divide-y divide-gray-50">
                  {services.map((s) => {
                    const on = selectedServices.includes(s.id);
                    return (
                      <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${on ? "bg-pink-50 text-pink-800" : "hover:bg-gray-50 text-gray-800"}`}>
                        <span>{on ? "✓ " : ""}{s.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {s.duration}m{s.price ? ` · $${s.price}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {chosen.length > 0 && (
                  <div className="mt-1.5 flex items-center justify-between text-xs bg-sand/40 border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-gray-700 truncate mr-2">
                      {chosen.length} service{chosen.length > 1 ? "s" : ""} · {totalDuration} min
                    </span>
                    <span className="font-semibold text-gray-900 flex-shrink-0">${totalPrice}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Package</label>
            <Select value={packageId}
              onChange={(e) => { setPackageId(e.target.value); setSelectedServices([]); setForm({ ...form, time: "" }); }}>
              <option value="">— None —</option>
              {packages.map((p) => <option key={p.id} value={p.id}>📦 {p.name} ({p.sessionCount} sessions · ${p.price})</option>)}
            </Select>
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
                <>
                  <p className="text-amber-700 text-xs font-medium">
                    ⚠ {linkedClient.name} has no active {selectedPackage.name} — a new package (${selectedPackage.price}) will be assigned with this booking
                  </p>
                  {/* How is the new package paid? */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {([
                      { value: "PAID", label: `Paid in full ($${selectedPackage.price})` },
                      { value: "PARTIAL", label: "Partially paid" },
                      { value: "UNPAID", label: "Not paid" },
                    ] as const).map((opt) => (
                      <label key={opt.value}
                        className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 cursor-pointer text-xs font-medium transition-colors ${pkgPayMode === opt.value ? "border-pink-600 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        <input type="radio" name="newpkgpay" checked={pkgPayMode === opt.value} onChange={() => setPkgPayMode(opt.value)} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {pkgPayMode === "PARTIAL" && (
                    <div className="flex items-center gap-2 pt-1">
                      <Input type="number" step="0.01" min={0} className="h-8 max-w-[120px]"
                        value={pkgPayAmount} onChange={(e) => setPkgPayAmount(e.target.value)} placeholder="Amount paid" />
                      {pkgPayAmount && (
                        <span className="text-xs text-amber-600">Balance due: ${(selectedPackage.price - parseFloat(pkgPayAmount || "0")).toFixed(2)}</span>
                      )}
                    </div>
                  )}
                </>
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
              {slotsError
                ? "Couldn't load available times — check the connection and change the date to retry"
                : form.staffId
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
