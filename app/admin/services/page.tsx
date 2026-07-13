"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Pencil } from "lucide-react";

interface Service {
  id: string;
  name: string;
  category: string;
  duration: number;
  price: number | null;
  description: string | null;
  isActive: boolean;
  reminderDays: number | null;
}

const CATEGORIES = ["skincare", "cellulite", "laser", "other"];

const blank = { name: "", category: "skincare", duration: 60, price: "", description: "", reminderDays: "" };

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    const data = await fetch("/api/services").then((r) => r.json());
    setServices(Array.isArray(data) ? data : []);
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, price: form.price ? parseFloat(form.price as string) : null, reminderDays: form.reminderDays ? parseInt(form.reminderDays as string) : null };
    if (editId) {
      await fetch(`/api/services/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setForm(blank); setShowForm(false); setEditId(null); load();
  }

  function startEdit(s: Service) {
    setForm({ name: s.name, category: s.category, duration: s.duration, price: s.price?.toString() || "", description: s.description || "", reminderDays: s.reminderDays?.toString() || "" });
    setEditId(s.id); setShowForm(true);
  }

  async function toggleActive(s: Service) {
    await fetch(`/api/services/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !s.isActive }) });
    load();
  }

  const grouped = CATEGORIES.map((cat) => ({ cat, items: services.filter((s) => s.category === cat) })).filter((g) => g.items.length > 0);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Services</h1>
        <Button size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm(blank); }}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{editId ? "Edit Service" : "New Service"}</CardTitle>
              <button onClick={() => { setShowForm(false); setEditId(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Gel Manicure" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes) *</label>
                <Input type="number" required value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) })} min={15} step={15} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Optional" step="0.01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rebooking Reminder (days)</label>
                <Input type="number" value={form.reminderDays} onChange={(e) => setForm({ ...form, reminderDays: e.target.value })} placeholder="e.g. 30 for laser" min={1} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">{editId ? "Update Service" : "Add Service"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {grouped.map(({ cat, items }) => (
        <div key={cat}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{cat}</h2>
          <div className="space-y-2">
            {items.map((s) => (
              <div key={s.id} className="flex items-start justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 gap-2">
                <div>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  {s.description && <p className="text-sm text-gray-500">{s.description}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{s.duration} min{s.price ? ` · $${s.price}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={s.isActive ? "success" : "outline"}>{s.isActive ? "Active" : "Off"}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(s)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(s)}>{s.isActive ? "Hide" : "Show"}</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
