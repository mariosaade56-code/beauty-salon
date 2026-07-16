"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
}

interface Appointment {
  status: string;
  paymentStatus: string | null;
  amountPaid: number | null;
  service: { price: number | null };
}

const CATEGORY_SUGGESTIONS = [
  "Rent", "Supplies", "Salaries", "Electricity (EDL)", "Generator",
  "Water", "Internet", "Marketing", "Maintenance", "Other",
];

export default function AccountingPage() {
  const now = new Date();
  const [from, setFrom] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [form, setForm] = useState({ date: format(now, "yyyy-MM-dd"), category: "", description: "", amount: "" });
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!from || !to) return;
    const [a, b] = from <= to ? [from, to] : [to, from];
    const [exp, appts] = await Promise.all([
      fetch(`/api/expenses?from=${a}&to=${b}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/appointments?from=${a}&to=${b}`).then((r) => (r.ok ? r.json() : [])),
    ]);
    setExpenses(Array.isArray(exp) ? exp : []);
    const completed = (Array.isArray(appts) ? appts : []).filter((x: Appointment) => x.status === "COMPLETED");
    setRevenue(
      completed.reduce(
        (sum: number, x: Appointment) => sum + (x.paymentStatus ? (x.amountPaid ?? 0) : (x.service.price || 0)),
        0
      )
    );
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setFormError(data.error || "Something went wrong");
      return;
    }
    setForm({ date: format(new Date(), "yyyy-MM-dd"), category: "", description: "", amount: "" });
    load();
  }

  async function removeExpense(exp: Expense) {
    if (!confirm(`Delete "${exp.category}" ($${exp.amount})?`)) return;
    await fetch(`/api/expenses/${exp.id}`, { method: "DELETE" });
    load();
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const net = revenue - totalExpenses;

  // Per-category totals for the period
  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  function preset(f: Date, t: Date) {
    setFrom(format(f, "yyyy-MM-dd"));
    setTo(format(t, "yyyy-MM-dd"));
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Accounting</h1>
          <p className="text-gray-500 text-sm mt-1">Expenses and profit for the chosen period</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => preset(startOfWeek(new Date(), { weekStartsOn: 1 }), endOfWeek(new Date(), { weekStartsOn: 1 }))}>Week</Button>
            <Button variant="outline" size="sm" onClick={() => preset(startOfMonth(new Date()), endOfMonth(new Date()))}>Month</Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Revenue (collected)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${revenue.toFixed(0)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-50 text-green-600">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Expenses</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${totalExpenses.toFixed(0)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-50 text-red-600">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Net Profit</p>
                <p className={`text-2xl font-bold mt-1 ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {net < 0 ? "-" : ""}${Math.abs(net).toFixed(0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add expense */}
      <Card>
        <CardHeader><CardTitle>Add Expense</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addExpense} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category *</label>
              <Input required list="expense-categories" placeholder="e.g. Rent"
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <datalist id="expense-categories">
                {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <Input placeholder="Optional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount ($) *</label>
              <Input type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <Button type="submit"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            {formError && <p className="text-sm text-red-500 col-span-2 md:col-span-5">{formError}</p>}
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Expense list */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Expenses in this period</CardTitle></CardHeader>
          <CardContent className="p-0">
            {expenses.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No expenses recorded for this period</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Category</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Description</th>
                    <th className="px-4 py-2.5 text-right font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{format(new Date(e.date), "MMM d, yyyy")}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{e.category}</td>
                      <td className="px-4 py-2.5 text-gray-500">{e.description || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">${e.amount.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => removeExpense(e)} className="text-gray-300 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* By category */}
        <Card>
          <CardHeader><CardTitle>By Category</CardTitle></CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No data</p>
            ) : (
              <div className="space-y-2.5">
                {byCategory.map(([cat, amount]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{cat}</span>
                    <span className="font-semibold text-gray-900">${amount.toFixed(0)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2.5">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-gray-900">${totalExpenses.toFixed(0)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
