"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Settings {
  salon_name?: string;
  salon_phone?: string;
  salon_address?: string;
  staff_selection_enabled?: string;
  whatsapp_ai_enabled?: string;
  cancellation_open?: string;
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
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
              value={settings.staff_selection_enabled !== "false"}
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
