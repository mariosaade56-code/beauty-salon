"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Pencil, Package } from "lucide-react";

interface Service { id: string; name: string; category: string; }
interface Pkg {
  id: string; name: string; sessionCount: number; price: number;
  validityDays: number; isActive: boolean;
  service: { name: string; category: string };
}

const blank = { name: "", serviceId: "", sessionCount: 4, price: "", validityDays: 365 };

export default function PackagesPage() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    const [pkgs, svcs] = await Promise.all([
      fetch("/api/packages").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
    ]);
    setPackages(pkgs);
    setServices(svcs);
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, price: parseFloat(form.price as string) };
    if (editId) {
      await fetch(`/api/packages/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/packages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setForm(blank); setShowForm(false); setEditId(null); load();
  }

  function startEdit(p: Pkg) {
    setForm({ name: p.name, serviceId: "", sessionCount: p.sessionCount, price: p.price.toString(), validityDays: p.validityDays });
    setEditId(p.id); setShowForm(true);
  }

  async function toggleActive(p: Pkg) {
    await fetch(`/api/packages/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !p.isActive }) });
    load();
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Packages</h1>
          <p className="text-sm text-gray-500 mt-1">Bundle sessions for discounted rates</p>
        </div>
        <Button size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm(blank); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Package
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{editId ? "Edit Package" : "New Package"}</CardTitle>
              <button onClick={() => { setShowForm(false); setEditId(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 4 Laser Sessions" />
              </div>
              {!editId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service *</label>
                  <Select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} required={!editId}>
                    <option value="">Select service…</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Sessions *</label>
                <Input type="number" required min={1} value={form.sessionCount} onChange={(e) => setForm({ ...form, sessionCount: parseInt(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Price ($) *</label>
                <Input type="number" required step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 299" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Validity (days)</label>
                <Input type="number" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: parseInt(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">{editId ? "Update Package" : "Create Package"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {packages.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No packages yet. Create one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {packages.map((p) => (
            <div key={p.id} className="flex items-start justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 gap-3">
              <div>
                <p className="font-semibold text-gray-900">{p.name}</p>
                <p className="text-sm text-gray-500">{p.service.name} · {p.sessionCount} sessions · ${p.price}</p>
                <p className="text-xs text-gray-400">Valid {p.validityDays} days</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={p.isActive ? "success" : "outline"}>{p.isActive ? "Active" : "Off"}</Badge>
                <Button size="sm" variant="ghost" onClick={() => startEdit(p)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>{p.isActive ? "Hide" : "Show"}</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
