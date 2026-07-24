"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { format, addDays } from "date-fns";
import { CheckCircle, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import Butterfly from "@/components/butterfly";

interface Service { id: string; name: string; category: string; duration: number; price: number | null; description: string | null; }
interface Staff { id: string; name: string; color: string; }
interface Slot { time: string; staffId: string; staffName: string; }
interface Pkg { id: string; name: string; price: number; sessionCount: number; serviceId: string; service: { name: string; duration: number }; services?: { id: string; name: string; duration: number }[]; }

function BookingForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [staffSelectionEnabled, setStaffSelectionEnabled] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [form, setForm] = useState({
    staffId: "", time: "", slotStaffId: "",
    clientName: "", phone: "", email: "",
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  // When a package covers several services, which one this first session is for
  const [pkgServiceId, setPkgServiceId] = useState("");

  function toggleService(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSelectedPkg(null);
    setForm((f) => ({ ...f, time: "" }));
  }

  // A package books on its own (one session of one of its services)
  function togglePackage(id: string) {
    setSelectedPkg((prev) => (prev === id ? null : id));
    setPkgServiceId("");
    setSelected([]);
    setForm((f) => ({ ...f, time: "" }));
  }
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const serviceGroups = [
    { key: "skincare", label: "Skincare", items: services.filter((s) => s.category === "skincare") },
    { key: "cellulite", label: "Cellulite Treatment", items: services.filter((s) => s.category === "cellulite") },
    { key: "ultimate", label: "Ultimate Full Body", items: services.filter((s) => s.name.includes("Ultimate Full Body")) },
    { key: "laser-women", label: "Laser Hair Removal — Women", items: services.filter((s) => s.category === "laser" && !s.name.includes("(Men)") && !s.name.includes("Ultimate Full Body")) },
    { key: "laser-men", label: "Laser Hair Removal — Men", items: services.filter((s) => s.category === "laser" && s.name.includes("(Men)")) },
    { key: "other", label: "Other", items: services.filter((s) => !["skincare", "cellulite", "laser"].includes(s.category)) },
  ].filter((g) => g.items.length > 0);

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then(setServices);
    fetch("/api/packages?public=1").then((r) => r.json()).then((d) => setPackages(Array.isArray(d) ? d : []));
    fetch("/api/staff").then((r) => r.json()).then(setStaff);
    fetch("/api/settings").then((r) => r.json()).then((s) => {
      // Hidden unless the admin explicitly turns it on
      setStaffSelectionEnabled(s.staff_selection_enabled === "true");
    });
  }, []);

  // Open the matching category when arriving from a homepage link
  useEffect(() => {
    const svc = searchParams.get("service");
    if (svc && services.length) {
      const map: Record<string, string> = { skincare: "skincare", cellulite: "cellulite", laser: "laser-women" };
      if (map[svc]) setOpenGroup(map[svc]);
    }
  }, [searchParams, services]);

  const activePkg = packages.find((p) => p.id === selectedPkg) || null;
  const pkgServices = activePkg?.services?.length ? activePkg.services : null;
  const pkgSessionService = activePkg
    ? pkgServices?.find((s) => s.id === pkgServiceId) || pkgServices?.[0] || null
    : null;
  const pkgSessionServiceId = activePkg ? pkgSessionService?.id || activePkg.serviceId : "";
  const bookingServiceIds = activePkg ? [pkgSessionServiceId] : selected;

  useEffect(() => {
    if (bookingServiceIds.length > 0) {
      const params = new URLSearchParams({
        serviceIds: bookingServiceIds.join(","),
        date: format(selectedDate, "yyyy-MM-dd"),
      });
      if (form.staffId) params.set("staffId", form.staffId);
      fetch(`/api/availability?${params}`).then((r) => r.json()).then((d) => setSlots(Array.isArray(d) ? d : []));
    } else {
      setSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedPkg, pkgSessionServiceId, form.staffId, selectedDate]);

  async function submit() {
    setSubmitting(true);
    const base = {
      clientName: form.clientName,
      phone: form.phone,
      email: form.email,
      staffId: form.slotStaffId || null,
      startTime: `${format(selectedDate, "yyyy-MM-dd")}T${form.time}:00`,
      source: "WEBSITE",
    };
    await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        activePkg
          ? { ...base, serviceId: pkgSessionServiceId, packageId: activePkg.id }
          : { ...base, serviceIds: selected }
      ),
    });
    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 border border-taupe/40 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-taupe" />
        </div>
        <h2 className="font-heading text-3xl font-medium mb-2">Booking Confirmed!</h2>
        <p className="text-charcoal/55 mb-2 font-light">You&apos;ll receive a WhatsApp confirmation shortly.</p>
        <p className="text-charcoal/55 mb-8 font-light">We&apos;ll also remind you 24h and 1h before your appointment.</p>
        <Link href="/" className="bg-charcoal text-cream tracking-wide px-8 py-3.5 rounded-full hover:bg-black transition-colors">
          Back to Home
        </Link>
      </div>
    );
  }

  const selectedServices = services.filter((s) => selected.includes(s.id));
  const totalPrice = activePkg ? activePkg.price : selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  const totalDuration = activePkg
    ? pkgSessionService?.duration ?? activePkg.service.duration
    : selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const cleanName = (n: string) => n.replace(" (Women)", "").replace(" (Men)", "");

  return (
    <div className="max-w-lg mx-auto">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s ? "bg-charcoal text-cream" : "bg-sand text-charcoal/40"}`}>{s}</div>
            {s < 3 && <div className={`flex-1 h-0.5 w-12 ${step > s ? "bg-charcoal" : "bg-sand"}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-charcoal/50">
          {step === 1 ? "Choose service & time" : step === 2 ? "Your details" : "Confirm"}
        </span>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-charcoal/70 mb-2">Services * <span className="font-normal text-charcoal/40">(you can pick more than one)</span></label>
            <div className="space-y-3">
              {packages.length > 0 && (
                <div className={`rounded-xl border-2 overflow-hidden transition-colors ${openGroup === "packages" || activePkg ? "border-charcoal" : "border-sand"} bg-cream-soft`}>
                  <button type="button"
                    onClick={() => setOpenGroup(openGroup === "packages" ? null : "packages")}
                    className="w-full flex items-center justify-between px-4 py-4 text-left">
                    <div>
                      <p className="font-heading text-lg font-medium text-charcoal">✨ Packages & Offers</p>
                      {activePkg ? (
                        <p className="text-xs text-taupe mt-0.5">✓ {activePkg.name}</p>
                      ) : (
                        <p className="text-xs text-charcoal/40 mt-0.5">{packages.length} offer{packages.length > 1 ? "s" : ""}</p>
                      )}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-charcoal/40 flex-shrink-0 transition-transform ${openGroup === "packages" ? "rotate-180" : ""}`} />
                  </button>
                  {openGroup === "packages" && (
                    <div className="grid grid-cols-1 gap-2 p-3 pt-0">
                      {packages.map((p) => {
                        const isSelected = selectedPkg === p.id;
                        const covers = p.services?.length ? p.services : [{ id: p.serviceId, name: p.service.name, duration: p.service.duration }];
                        return (
                          <div key={p.id}
                            className={`rounded-lg border-2 transition-all ${isSelected ? "border-charcoal bg-sand/40" : "border-sand bg-cream hover:border-taupe"}`}>
                            <button type="button" onClick={() => togglePackage(p.id)} className="w-full p-3 text-left">
                              <p className="font-medium text-charcoal text-sm">{isSelected ? "✓ " : ""}{p.name}</p>
                              <p className="text-xs text-charcoal/50">
                                {p.sessionCount} sessions · ${p.price} — first session booked now
                              </p>
                              <p className="text-xs text-charcoal/40 mt-0.5">
                                Use on: {covers.map((s) => cleanName(s.name)).join(", ")}
                              </p>
                            </button>
                            {isSelected && covers.length > 1 && (
                              <div className="px-3 pb-3">
                                <p className="text-xs text-charcoal/60 mb-1.5">Which one for this first session?</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {covers.map((s) => (
                                    <button key={s.id} type="button"
                                      onClick={() => { setPkgServiceId(s.id); setForm((f) => ({ ...f, time: "" })); }}
                                      className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${pkgSessionServiceId === s.id ? "bg-charcoal text-cream border-charcoal" : "bg-cream border-sand text-charcoal/70 hover:border-taupe"}`}>
                                      {cleanName(s.name)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {serviceGroups.map((group) => {
                const isOpen = openGroup === group.key;
                const selectedInGroup = group.items.filter((s) => selected.includes(s.id));
                return (
                  <div key={group.key} className={`rounded-xl border-2 overflow-hidden transition-colors ${isOpen || selectedInGroup.length ? "border-charcoal" : "border-sand"} bg-cream-soft`}>
                    <button type="button"
                      onClick={() => setOpenGroup(isOpen ? null : group.key)}
                      className="w-full flex items-center justify-between px-4 py-4 text-left">
                      <div>
                        <p className="font-heading text-lg font-medium text-charcoal">{group.label}</p>
                        {selectedInGroup.length > 0 ? (
                          <p className="text-xs text-taupe mt-0.5">
                            ✓ {selectedInGroup.map((s) => cleanName(s.name)).join(", ")}
                          </p>
                        ) : (
                          <p className="text-xs text-charcoal/40 mt-0.5">{group.items.length} service{group.items.length !== 1 ? "s" : ""}</p>
                        )}
                      </div>
                      <ChevronDown className={`w-5 h-5 text-charcoal/40 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="grid grid-cols-2 gap-2 p-3 pt-0">
                        {group.items.map((s) => {
                          const isSelected = selected.includes(s.id);
                          return (
                            <button key={s.id} type="button"
                              onClick={() => toggleService(s.id)}
                              className={`p-3 rounded-lg border-2 text-left transition-all ${isSelected ? "border-charcoal bg-sand/40" : "border-sand bg-cream hover:border-taupe"} ${group.items.length === 1 ? "col-span-2" : ""}`}>
                              <p className="font-medium text-charcoal text-sm">{isSelected ? "✓ " : ""}{cleanName(s.name)}</p>
                              <p className="text-xs text-charcoal/50">{s.duration} min{s.price ? ` · $${s.price}` : ""}</p>
                              {s.description && <p className="text-xs text-charcoal/40 mt-1">{s.description}</p>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {(selectedServices.length > 0 || activePkg) && (
            <div className="bg-sand/50 border border-sand rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-charcoal">
                {activePkg
                  ? `${activePkg.name} · session of ${totalDuration} min`
                  : `${selectedServices.length} service${selectedServices.length > 1 ? "s" : ""} · ${totalDuration} min`}
              </p>
              <p className="font-semibold text-charcoal">${totalPrice}</p>
            </div>
          )}

          {staffSelectionEnabled && bookingServiceIds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-charcoal/70 mb-2">Staff (optional)</label>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setForm({ ...form, staffId: "" })}
                  className={`px-4 py-2 rounded-full border text-sm ${!form.staffId ? "border-charcoal bg-sand/40 text-charcoal" : "border-sand bg-cream-soft text-charcoal/60"}`}>
                  Any available
                </button>
                {staff.map((s) => (
                  <button key={s.id} type="button" onClick={() => setForm({ ...form, staffId: s.id })}
                    className={`px-4 py-2 rounded-full border text-sm flex items-center gap-2 ${form.staffId === s.id ? "border-charcoal bg-sand/40 text-charcoal" : "border-sand bg-cream-soft text-charcoal/60"}`}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {bookingServiceIds.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-charcoal/70">Date</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} disabled={selectedDate <= new Date()}>
                    <ChevronLeft className="w-4 h-4 text-charcoal/40" />
                  </button>
                  <span className="text-sm font-medium">{format(selectedDate, "EEE, MMM d")}</span>
                  <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                    <ChevronRight className="w-4 h-4 text-charcoal/40" />
                  </button>
                </div>
              </div>
              {slots.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <button key={slot.time} type="button"
                      onClick={() => setForm({ ...form, time: slot.time, slotStaffId: slot.staffId })}
                      className={`py-2 rounded-full text-sm font-medium border transition-colors ${form.time === slot.time ? "bg-charcoal text-cream border-charcoal" : "border-sand bg-cream-soft hover:border-taupe"}`}>
                      {slot.time}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-charcoal/40 text-center py-4">No slots available. Try another date.</p>
              )}
            </div>
          )}

          <Button className="w-full bg-charcoal text-cream hover:bg-black rounded-full h-12" disabled={bookingServiceIds.length === 0 || !form.time} onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-sand/50 border border-sand rounded-xl p-4 mb-4">
            {activePkg ? (
              <div className="flex items-center justify-between">
                <p className="font-heading text-lg font-medium text-charcoal">{activePkg.name}</p>
                <p className="text-sm text-charcoal/60">${activePkg.price}</p>
              </div>
            ) : (
              selectedServices.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <p className="font-heading text-lg font-medium text-charcoal">{cleanName(s.name)}</p>
                  {s.price && <p className="text-sm text-charcoal/60">${s.price}</p>}
                </div>
              ))
            )}
            <p className="text-sm text-taupe mt-1.5">{format(selectedDate, "EEEE, MMMM d")} at {form.time} · {totalDuration} min{totalPrice ? ` · $${totalPrice} total` : ""}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal/70 mb-1">Full Name *</label>
            <Input required value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Your name" className="bg-cream-soft border-sand" />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal/70 mb-1">WhatsApp Number *</label>
            <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 234 567 8900" className="bg-cream-soft border-sand" />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal/70 mb-1">Email (optional)</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" className="bg-cream-soft border-sand" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-full h-12 border-charcoal/25 bg-transparent text-charcoal hover:bg-cream-soft" onClick={() => setStep(1)}>Back</Button>
            <Button className="flex-1 bg-charcoal text-cream hover:bg-black rounded-full h-12" disabled={!form.clientName || !form.phone} onClick={submit}>
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
    <div className="min-h-screen bg-cream text-charcoal">
      <div className="bg-cream/85 backdrop-blur-md border-b border-sand">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="text-charcoal/40 hover:text-charcoal">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-1">
            <Butterfly className="w-8 h-8 -mt-1" />
            <span className="font-brand text-2xl leading-none">Divine Skin</span>
          </div>
          <span className="ml-auto text-sm text-charcoal/50 tracking-wide">Book Appointment</span>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Suspense fallback={<div className="text-center py-10 text-charcoal/40">Loading...</div>}>
          <BookingForm />
        </Suspense>
      </div>
    </div>
  );
}
