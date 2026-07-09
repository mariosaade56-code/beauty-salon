"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Search, Upload, Phone, Mail, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: string;
  _count: { appointments: number };
  appointments: { startTime: string; service: { name: string } }[];
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  async function load(q = "") {
    const data = await fetch(`/api/clients?search=${encodeURIComponent(q)}`).then((r) => r.json());
    setClients(data);
  }

  useEffect(() => { load(); }, []);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean).slice(1); // skip header
    const clients = lines.map((line) => {
      const [name, phone, email] = line.split(",").map((s) => s.trim().replace(/"/g, ""));
      return { name, phone, email };
    }).filter((c) => c.name && c.phone);
    await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clients) });
    setImporting(false);
    load();
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Clients</h1>
        <label className="cursor-pointer">
          <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" disabled={importing} onClick={() => {}}>
            <Upload className="w-4 h-4 mr-1" />
            {importing ? "Importing..." : "Import CSV"}
          </Button>
        </label>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          className="pl-10"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); load(e.target.value); }}
        />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {clients.map((c) => (
          <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/admin/clients/${c.id}`)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
              <p className="font-semibold text-gray-900">{c.name}</p>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /></div>
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{c.phone}</p>
              {c.email && <p className="text-sm text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</p>}
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>{c._count.appointments} visit{c._count.appointments !== 1 ? "s" : ""}</span>
                <span>Since {format(new Date(c.createdAt), "MMM yyyy")}</span>
              </div>
              {c.appointments[0] && (
                <p className="text-xs text-gray-400 mt-1">Last: {c.appointments[0].service.name} · {format(new Date(c.appointments[0].startTime), "MMM d, yyyy")}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {clients.length === 0 && <p className="text-center text-gray-400 py-10">No clients found</p>}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Visits</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Last Visit</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Member Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/admin/clients/${c.id}`)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</div>
                    {c.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium">{c._count.appointments}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.appointments[0]
                      ? `${format(new Date(c.appointments[0].startTime), "MMM d, yyyy")} · ${c.appointments[0].service.name}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(c.createdAt), "MMM d, yyyy")}</td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan={5} className="text-center py-16 text-gray-400">No clients found</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
