"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, UserCircle } from "lucide-react";

interface Staff {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  color: string;
  isActive: boolean;
  user: { email: string; role: string; isActive: boolean } | null;
}

const COLORS = ["#ec4899", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#84cc16"];

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", color: COLORS[0] });
  const [accountFor, setAccountFor] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({ email: "", password: "" });
  const [accountMsg, setAccountMsg] = useState("");

  async function updateAccount(staffId: string, patch: { role?: string; isActive?: boolean }) {
    const res = await fetch(`/api/staff/${staffId}/account`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Something went wrong");
    }
    load();
  }

  async function saveAccount(e: React.FormEvent, staffId: string) {
    e.preventDefault();
    setAccountMsg("");
    const res = await fetch(`/api/staff/${staffId}/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setAccountMsg(data.error || "Something went wrong");
      return;
    }
    setAccountFor(null);
    setAccountForm({ email: "", password: "" });
    load();
  }

  async function load() {
    const data = await fetch("/api/staff").then((r) => r.json());
    setStaff(Array.isArray(data) ? data : []);
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", email: "", phone: "", color: COLORS[0] });
    setShowForm(false);
    load();
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Staff</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Staff
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>New Staff Member</CardTitle>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Calendar Color</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-2 ring-gray-400" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button type="submit">Add Staff Member</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: s.color }}>
                  {s.name[0]}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{s.name}</p>
                  {s.email && <p className="text-sm text-gray-500">{s.email}</p>}
                  {s.phone && <p className="text-sm text-gray-500">{s.phone}</p>}
                </div>
                <Badge variant={s.isActive ? "success" : "outline"}>
                  {s.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => toggle(s.id, s.isActive)}>
                  {s.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="outline" size="sm" className="flex-1"
                  onClick={() => {
                    setAccountFor(accountFor === s.id ? null : s.id);
                    setAccountForm({ email: s.user?.email || s.email || "", password: "" });
                    setAccountMsg("");
                  }}>
                  {s.user ? "Reset Login" : "Create Login"}
                </Button>
              </div>

              {s.user && accountFor !== s.id && (
                <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400 truncate mr-2">Login: {s.user.email}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <Badge variant="outline">{s.user.role === "ADMIN" ? "Admin" : "Staff"}</Badge>
                      <Badge variant={s.user.isActive ? "success" : "destructive"}>
                        {s.user.isActive ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1"
                      onClick={() => updateAccount(s.id, { role: s.user!.role === "ADMIN" ? "STAFF" : "ADMIN" })}>
                      {s.user.role === "ADMIN" ? "Remove Admin" : "Make Admin"}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1"
                      onClick={() => updateAccount(s.id, { isActive: !s.user!.isActive })}>
                      {s.user.isActive ? "Disable Login" : "Enable Login"}
                    </Button>
                  </div>
                </div>
              )}

              {accountFor === s.id && (
                <form onSubmit={(e) => saveAccount(e, s.id)} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <Input required type="text" placeholder="Login username or email"
                    value={accountForm.email}
                    onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} />
                  <Input required type="text" placeholder={s.user ? "New password" : "Password"}
                    value={accountForm.password}
                    onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} />
                  {accountMsg && <p className="text-xs text-red-500">{accountMsg}</p>}
                  <Button type="submit" size="sm" className="w-full">
                    {s.user ? "Update Login" : "Create Login"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
