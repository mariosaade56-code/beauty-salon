"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Plus, X, KeyRound, Trash2, UserCog } from "lucide-react";

interface Account {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  staffProfile: { name: string } | null;
}

const blank = { name: "", email: "", password: "", role: "STAFF" };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [meId, setMeId] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  async function load() {
    const [accs, me] = await Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]);
    setAccounts(Array.isArray(accs) ? accs : []);
    if (me?.id) setMeId(me.id);
  }

  useEffect(() => { load(); }, []);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error || "Something went wrong"); return; }
    setShowNew(false);
    setForm(blank);
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Something went wrong");
    }
    load();
  }

  async function savePassword(id: string) {
    await patch(id, { password: resetPassword });
    setResetFor(null);
    setResetPassword("");
  }

  async function remove(a: Account) {
    if (!confirm(`Delete the account ${a.email}? This cannot be undone.`)) return;
    const res = await fetch(`/api/accounts/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Something went wrong");
    }
    load();
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Everyone who can sign in to this system</p>
        </div>
        <Button size="sm" onClick={() => { setShowNew(true); setFormError(""); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Account
        </Button>
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>New Account</CardTitle>
              <button onClick={() => setShowNew(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={createAccount} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username or Email *</label>
                <Input type="text" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <Input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="STAFF">Staff — appointments only</option>
                  <option value="ADMIN">Admin — full access</option>
                </Select>
              </div>
              {formError && <p className="text-sm text-red-500 md:col-span-2">{formError}</p>}
              <div className="md:col-span-2">
                <Button type="submit">Create Account</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {accounts.map((a) => {
          const isMe = a.id === meId;
          return (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {a.name || a.email} {isMe && <span className="text-xs font-normal text-gray-400">(you)</span>}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{a.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.staffProfile ? `Staff profile: ${a.staffProfile.name} · ` : ""}
                      Since {format(new Date(a.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Badge variant="outline">{a.role === "ADMIN" ? "Admin" : "Staff"}</Badge>
                    <Badge variant={a.isActive ? "success" : "destructive"}>{a.isActive ? "Enabled" : "Disabled"}</Badge>
                  </div>
                </div>

                {resetFor === a.id ? (
                  <div className="flex gap-2 mt-3">
                    <Input autoFocus placeholder="New password" value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)} />
                    <Button size="sm" onClick={() => savePassword(a.id)} disabled={resetPassword.length < 4}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setResetFor(null); setResetPassword(""); }}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {!isMe && (
                      <Button variant="outline" size="sm"
                        onClick={() => patch(a.id, { role: a.role === "ADMIN" ? "STAFF" : "ADMIN" })}>
                        <UserCog className="w-3.5 h-3.5 mr-1" />
                        {a.role === "ADMIN" ? "Remove Admin" : "Make Admin"}
                      </Button>
                    )}
                    {!isMe && (
                      <Button variant="outline" size="sm" onClick={() => patch(a.id, { isActive: !a.isActive })}>
                        {a.isActive ? "Disable" : "Enable"}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => { setResetFor(a.id); setResetPassword(""); }}>
                      <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset Password
                    </Button>
                    {!isMe && (
                      <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600"
                        onClick={() => remove(a)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
