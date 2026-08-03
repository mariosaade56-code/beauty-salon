"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_BIRTHDAY_MESSAGE } from "@/lib/messaging";

interface Settings {
  salon_name?: string;
  salon_phone?: string;
  salon_address?: string;
  staff_selection_enabled?: string;
  whatsapp_ai_enabled?: string;
  cancellation_open?: string;
  instagram_url?: string;
  tiktok_url?: string;
  google_reviews_url?: string;
  service_discount_percent?: string;
  birthday_message?: string;
  whatsapp_country_code?: string;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-pink-600" : "bg-gray-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  async function save() {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function set(key: keyof Settings, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Settings</h1>
        <Button onClick={save}>{saved ? "✓ Saved!" : "Save Changes"}</Button>
      </div>

      {/* Salon Info */}
      <Card>
        <CardHeader><CardTitle>Salon Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salon Name</label>
            <Input value={settings.salon_name || ""} onChange={(e) => set("salon_name", e.target.value)} placeholder="My Beauty Salon" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <Input value={settings.salon_phone || ""} onChange={(e) => set("salon_phone", e.target.value)} placeholder="+1 234 567 8900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <Input value={settings.salon_address || ""} onChange={(e) => set("salon_address", e.target.value)} placeholder="123 Main St" />
          </div>
        </CardContent>
      </Card>

      {/* Salon-wide discount on services */}
      <Card>
        <CardHeader><CardTitle>Discount on All Services</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
            <Input type="number" min={0} max={100} step={1}
              value={settings.service_discount_percent || ""}
              onChange={(e) => set("service_discount_percent", e.target.value)}
              placeholder="Leave empty for no discount" />
          </div>
          {(() => {
            const pct = parseFloat(settings.service_discount_percent || "");
            if (!Number.isFinite(pct) || pct <= 0) {
              return <p className="text-sm text-gray-500">No discount running — clients pay the normal price.</p>;
            }
            return (
              <div className="bg-pink-50 border border-pink-200 rounded-lg px-4 py-3 text-sm">
                <p className="font-medium text-pink-800">{pct}% off every service is running</p>
                <p className="text-pink-700 mt-0.5">
                  A $100 service now costs <span className="font-semibold">${(100 * (1 - pct / 100)).toFixed(2)}</span>.
                  Discounted prices show on the booking page and are used when recording payment.
                  Set it back to empty to end the offer.
                </p>
              </div>
            );
          })()}
          <p className="text-xs text-gray-400">
            Packages and products are priced separately — this only affects services.
          </p>
        </CardContent>
      </Card>

      {/* Birthday wishes */}
      <Card>
        <CardHeader><CardTitle>Birthday Message</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What to send <span className="font-normal text-gray-400">— write {"{name}"} where the client&apos;s name should go</span>
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-black min-h-[80px]"
              value={settings.birthday_message ?? DEFAULT_BIRTHDAY_MESSAGE}
              onChange={(e) => set("birthday_message", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country code for WhatsApp</label>
            <Input value={settings.whatsapp_country_code ?? "961"}
              onChange={(e) => set("whatsapp_country_code", e.target.value.replace(/\D/g, ""))}
              placeholder="961" className="max-w-[120px]" />
            <p className="text-xs text-gray-400 mt-1">
              Added to numbers saved without one — 961 is Lebanon.
            </p>
          </div>
          <p className="text-xs text-gray-500">
            Clients with a birthday today appear on the Dashboard. Pressing Send wishes opens
            WhatsApp with this message ready — you still tap send yourself.
          </p>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader><CardTitle>Social Media & Reviews</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram URL</label>
            <Input value={settings.instagram_url || ""} onChange={(e) => set("instagram_url", e.target.value)} placeholder="https://instagram.com/yoursalon" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TikTok URL</label>
            <Input value={settings.tiktok_url || ""} onChange={(e) => set("tiktok_url", e.target.value)} placeholder="https://tiktok.com/@yoursalon" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Reviews URL</label>
            <Input value={settings.google_reviews_url || ""} onChange={(e) => set("google_reviews_url", e.target.value)} placeholder="https://g.page/r/..." />
          </div>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader><CardTitle>Feature Toggles</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Staff Selection</p>
              <p className="text-sm text-gray-500">Allow clients to choose a specific staff member when booking</p>
            </div>
            <Toggle
              value={settings.staff_selection_enabled === "true"}
              onChange={(v) => set("staff_selection_enabled", v ? "true" : "false")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">WhatsApp AI Agent</p>
              <p className="text-sm text-gray-500">Automatically handle WhatsApp booking requests with AI</p>
            </div>
            <Toggle
              value={settings.whatsapp_ai_enabled !== "false"}
              onChange={(v) => set("whatsapp_ai_enabled", v ? "true" : "false")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Open Cancellations</p>
              <p className="text-sm text-gray-500">Allow clients to cancel appointments freely (no deposit required)</p>
            </div>
            <Toggle
              value={settings.cancellation_open !== "false"}
              onChange={(v) => set("cancellation_open", v ? "true" : "false")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
