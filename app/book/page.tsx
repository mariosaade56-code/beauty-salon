"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { format, addDays } from "date-fns";
import { Sparkles, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Service { id: string; name: string; category: string; duration: number; price: number | null; }
interface Staff { id: string; name: string; color: string; }
interface Slot { time: string; staffId: string; staffName: string; }

function BookingForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [staffSelectionEnabled, setStaffSelectionEnabled] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [form, setForm] = useState({
    serviceId: "", staffId: "", time: "", slotStaffId: "",
    clientName: "", phone: "", email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then(setServices);
    fetch("/api/staff").then((r) => r.json()).then(setStaff);
    fetch("/api/settings").then((r) => r.json()).then((s) => {
      setStaffSelectionEnabled(s.staff_selection_enabled !== "false");
    });
  }, []);

  // Pre-select service from URL
  useEffect(() => {
    const svc = searchParams.get("service");
    if (svc && services.length) {
      const match = services.find((s) => s.category === svc || s.name.toLowerCase().includes(svc));
      if (match) setForm((f) => ({ ...f, serviceId: match.id }));
    }
  }, [searchParams, services]);

  useEffect(() => {
    if (form.serviceId) {
      const params = new URLSearchParams({
        serviceId: form.serviceId,
        date: format(selectedDate, "yyyy-MM-dd"),
      });
      if (form.staffId) params.set("staffId", form.staffId);
      fetch(`/api/availability?${params}`).then((r) => r.json()).then(setSlots);
    }
  }, [form.serviceId, form.staffId, selectedDate]);

  async function submit() {
    setSubmitting(true);
    await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: form.clientName,
        phone: form.phone,
        email: form.email,
        serviceId: form.serviceId,
        staffId: form.slotStaffId || null,
        startTime: `${format(selectedDate, "yyyy-MM-dd")}T${form.time}:00`,
        source: "WEBSITE",
      }),
    });
    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
        <p className="text-gray-500 mb-2">You&apos;ll receive a WhatsApp confirmation shortly.</p>
        <p className="text-gray-500 mb-8">We&apos;ll also remind you 24h and 1h before your appointment.</p>
        <Link href="/" className="bg-pink-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-pink-700 transition-colors">
          Back to Home
        </Link>
      </div>
    );
  }

  const selectedService = services.find((s) => s.id === form.serviceId);

  return (
    <div className="max-w-lg mx-auto">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-400"}`}>{s}</div>
            {s < 3 && <div className={`flex-1 h-0.5 w-12 ${step > s ? "bg-pink-600" : "bg-gray-200"}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-gray-500">
          {step === 1 ? "Choose service & time" : step === 2 ? "Your details" : "Confirm"}
        </span>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service *</label>
            <div className="grid grid-cols-2 gap-3">
              {services.map((s) => (
                <button key={s.id} type="button"
                  onClick={() => setForm({ ...form, serviceId: s.id, time: "" })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${form.serviceId === s.id ? "border-pink-600 bg-pink-50" : "border-gray-200 hover:border-pink-200"}`}>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.duration} min{s.price ? ` · $${s.price}` : ""}</p>
                </button>
              ))}
            </div>
          </div>

          {staffSelectionEnabled && form.serviceId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Staff (optional)</label>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setForm({ ...form, staffId: "" })}
                  className={`px-4 py-2 rounded-lg border text-sm ${!form.staffId ? "border-pink-600 bg-pink-50 text-pink-700" : "border-gray-200"}`}>
                  Any available
                </button>
                {staff.map((s) => (
                  <button key={s.id} type="button" onClick={() => setForm({ ...form, staffId: s.id })}
                    className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 ${form.staffId === s.id ? "border-pink-600 bg-pink-50 text-pink-700" : "border-gray-200"}`}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.serviceId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Date</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} disabled={selectedDate <= new Date()}>
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <span className="text-sm font-medium">{format(selectedDate, "EEE, MMM d")}</span>
                  <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              {slots.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <button key={slot.time} type="button"
                      onClick={() => setForm({ ...form, time: slot.time, slotStaffId: slot.staffId })}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${form.time === slot.time ? "bg-pink-600 text-white border-pink-600" : "border-gray-200 hover:border-pink-300"}`}>
                      {slot.time}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No slots available. Try another date.</p>
              )}
            </div>
          )}

          <Button className="w-full" disabled={!form.serviceId || !form.time} onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-xl p-4 mb-4">
            <p className="font-medium text-pink-800">{selectedService?.name}</p>
            <p className="text-sm text-pink-600">{format(selectedDate, "EEEE, MMMM d")} at {form.time}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <Input required value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Your name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number *</label>
            <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 234 567 8900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
            <Button className="flex-1" disabled={!form.clientName || !form.phone} onClick={submit}>
              {submitting ? "Booking..." : "Confirm Booking"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-pink-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Book Appointment</span>
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Suspense fallback={<div className="text-center py-10 text-gray-400">Loading...</div>}>
          <BookingForm />
        </Suspense>
      </div>
    </div>
  );
}
