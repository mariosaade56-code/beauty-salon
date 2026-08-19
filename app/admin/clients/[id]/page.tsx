"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ChevronLeft, Package, Camera, Trash2, Plus, X, Download } from "lucide-react";

interface Package { id: string; name: string; sessionCount: number; price: number; service: { name: string }; services?: { id: string; name: string }[]; }
interface ClientPackage {
  id: string; sessionsTotal: number; sessionsUsed: number; purchasedAt: string; expiresAt: string | null; notes: string | null;
  package: { name: string; service: { name: string; category: string }; services?: { id: string; name: string }[]; };
  appointments: { id: string; startTime: string; status: string }[];
}
interface Photo { id: string; url: string; type: string; notes: string | null; takenAt: string; }
interface Client { id: string; name: string; phone: string; email: string | null; notes: string | null; dob: string | null; address: string | null; createdAt: string; }
interface Transaction { id: string; date: string; description: string; amount: number; paid: boolean; reference: string | null; }
interface Visit {
  id: string; startTime: string; status: string;
  paymentStatus: string | null; amountPaid: number | null; notes: string | null;
  clientPackageId: string | null;
  service: { name: string; category: string; price: number | null };
  staff: { name: string } | null;
}

// Groups the service categories into the buckets Sandy actually asks for
const VISIT_FILTERS = [
  { key: "all", label: "All" },
  { key: "laser", label: "Laser" },
  { key: "cellulite", label: "Cellulite" },
  { key: "skincare", label: "Skincare" },
  { key: "other", label: "Other" },
] as const;

interface Prepaid {
  id: string; amount: number; paid: boolean; notes: string | null;
  description: string | null; createdAt: string; usedAt: string | null;
  sessionsTotal: number; sessionsUsed: number; groupId: string | null;
  service: { id: string; name: string; duration: number } | null;
}

const KNOWN_BUCKETS = ["laser", "cellulite", "skincare"];
function visitBucket(v: Visit): string {
  const cat = (v.service.category || "").toLowerCase();
  return KNOWN_BUCKETS.includes(cat) ? cat : "other";
}

// Only a treatment actually given counts as a session. No-shows and
// cancellations are history worth keeping, but nothing was done.
const isDone = (v: Visit) => v.status === "COMPLETED";
const isUpcoming = (v: Visit) => v.status === "PENDING" || v.status === "CONFIRMED";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "COMPLETED", label: "Done" },
  { key: "NO_SHOW", label: "No-show" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "upcoming", label: "Upcoming" },
] as const;


export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [clientPackages, setClientPackages] = useState<ClientPackage[]>([]);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<"record" | "visits" | "packages" | "photos">("record");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitFilter, setVisitFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Paid for, not booked yet
  const [prepaid, setPrepaid] = useState<Prepaid[]>([]);
  const [services, setServices] = useState<{ id: string; name: string; price: number | null }[]>([]);
  const [showPrepaidForm, setShowPrepaidForm] = useState(false);
  // serviceId -> { sessions, amount } for everything ticked
  const [ppPicked, setPpPicked] = useState<Record<string, { sessions: string; amount: string }>>({});
  const [ppSearch, setPpSearch] = useState("");
  const [ppOther, setPpOther] = useState("");
  const [ppAmount, setPpAmount] = useState("");
  const [ppSessions, setPpSessions] = useState("1");
  const [ppPaid, setPpPaid] = useState(true);
  const [ppNotes, setPpNotes] = useState("");
  // "each" = a price per service, "bundle" = one price for the lot
  const [ppMode, setPpMode] = useState<"each" | "bundle">("each");
  const [ppBundle, setPpBundle] = useState("");
  const [savingPp, setSavingPp] = useState(false);

  // Services bought together on one price show as a single deal
  function groupPrepaid(rows: Prepaid[]): { key: string; rows: Prepaid[] }[] {
    const out: { key: string; rows: Prepaid[] }[] = [];
    const seen = new Map<string, { key: string; rows: Prepaid[] }>();
    for (const r of rows) {
      if (!r.groupId) { out.push({ key: r.id, rows: [r] }); continue; }
      const g = seen.get(r.groupId);
      if (g) g.rows.push(r);
      else { const entry = { key: r.groupId, rows: [r] }; seen.set(r.groupId, entry); out.push(entry); }
    }
    return out;
  }

  async function loadPrepaid() {
    const d = await fetch(`/api/clients/${id}/prepaid`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    setPrepaid(Array.isArray(d) ? d : []);
  }

  function resetPrepaidForm() {
    setPpPicked({}); setPpSearch(""); setPpOther(""); setPpAmount("");
    setPpSessions("1"); setPpPaid(true); setPpNotes("");
    setPpMode("each"); setPpBundle("");
  }

  /**
   * Shares one bundle price across the chosen services, weighted by what
   * they'd normally cost, so the parts always add back up to the total.
   */
  function splitBundle(total: number): Record<string, number> {
    const entries = Object.entries(ppPicked);
    if (!entries.length) return {};
    const weights = entries.map(([sid, row]) => {
      const unit = services.find((x) => x.id === sid)?.price ?? 0;
      return Math.max(unit, 0) * Math.max(parseInt(row.sessions) || 1, 1);
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    const cents = Math.round(total * 100);
    const out: Record<string, number> = {};
    let used = 0;
    entries.forEach(([sid], i) => {
      // Even split when nothing has a list price to weight by
      const share = sum > 0 ? weights[i] / sum : 1 / entries.length;
      const part = i === entries.length - 1 ? cents - used : Math.round(cents * share);
      used += part;
      out[sid] = part / 100;
    });
    return out;
  }

  function togglePpService(sv: { id: string; price: number | null }) {
    setPpPicked((prev) => {
      const next = { ...prev };
      if (next[sv.id]) delete next[sv.id];
      else next[sv.id] = { sessions: "1", amount: sv.price != null ? String(sv.price) : "" };
      return next;
    });
  }

  function setPpField(id: string, field: "sessions" | "amount", value: string) {
    setPpPicked((prev) => {
      const row = prev[id];
      if (!row) return prev;
      const next = { ...prev, [id]: { ...row, [field]: value } };
      // Keep the price in step with the session count
      if (field === "sessions") {
        const unit = services.find((s) => s.id === id)?.price;
        const n = Math.max(parseInt(value) || 1, 1);
        if (unit != null) next[id].amount = String(unit * n);
      }
      return next;
    });
  }

  const ppTotal =
    Object.keys(ppPicked).length === 0
      ? parseFloat(ppAmount) || 0
      : ppMode === "bundle"
      ? parseFloat(ppBundle) || 0
      : Object.values(ppPicked).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  async function addPrepaid(e: React.FormEvent) {
    e.preventDefault();
    setSavingPp(true);
    const picked = Object.entries(ppPicked);
    const shares = ppMode === "bundle" ? splitBundle(parseFloat(ppBundle) || 0) : null;
    const payload = picked.length
      ? {
          items: picked.map(([serviceId, row]) => ({
            serviceId,
            sessionsTotal: row.sessions,
            amount: shares ? shares[serviceId] : row.amount,
          })),
          paid: ppPaid,
          notes: ppNotes,
        }
      : {
          serviceId: null,
          description: ppOther,
          amount: ppAmount,
          sessionsTotal: ppSessions,
          paid: ppPaid,
          notes: ppNotes,
        };
    const res = await fetch(`/api/clients/${id}/prepaid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    setSavingPp(false);
    if (!res || !res.ok) {
      const d = res ? await res.json().catch(() => ({})) : {};
      return alert(d.error || "Could not save — please try again.");
    }
    resetPrepaidForm(); setShowPrepaidForm(false);
    loadPrepaid(); load();
  }

  async function togglePrepaidUsed(pp: Prepaid) {
    await fetch(`/api/prepaid/${pp.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ used: !pp.usedAt }),
    });
    loadPrepaid();
  }

  async function deletePrepaid(rows: Prepaid[]) {
    const what = rows.map((r) => r.service?.name || r.description).join(" + ");
    const total = rows.reduce((s, r) => s + r.amount, 0);
    if (!confirm(`Remove the prepaid ${what}? The $${total.toFixed(2)} also comes out of their history.`)) return;
    await Promise.all(rows.map((r) => fetch(`/api/prepaid/${r.id}`, { method: "DELETE" })));
    loadPrepaid(); load();
  }

  async function markGroupDone(rows: Prepaid[], done: boolean) {
    await Promise.all(rows.map((r) =>
      fetch(`/api/prepaid/${r.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ used: done }),
      })));
    loadPrepaid();
  }
  const [profile, setProfile] = useState({ name: "", phone: "", email: "", dob: "", address: "", notes: "" });
  const [profileSaved, setProfileSaved] = useState(false);
  const [txForm, setTxForm] = useState({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", paid: true, reference: "" });
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState("");
  const [pkgNotes, setPkgNotes] = useState("");
  const [pkgPayMode, setPkgPayMode] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [pkgPayAmount, setPkgPayAmount] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().slice(0, 10));
  const [photoNotes, setPhotoNotes] = useState("");
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState("STAFF");
  const isAdmin = role === "ADMIN";
  const [todos, setTodos] = useState<{ id: string; description: string; fromService: string | null; createdAt: string; doneAt: string | null }[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [addingTodo, setAddingTodo] = useState(false);

  async function loadTodos() {
    const d = await fetch(`/api/clients/${id}/pending`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    setTodos(Array.isArray(d) ? d : []);
  }

  async function addTodo() {
    if (!newTodo.trim()) return;
    await fetch(`/api/clients/${id}/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: newTodo.trim() }),
    });
    setNewTodo(""); setAddingTodo(false);
    loadTodos();
  }

  async function markTodoDone(todoId: string) {
    await fetch(`/api/pending/${todoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    loadTodos();
  }

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((u) => { if (u?.role) setRole(u.role); }).catch(() => {});
    loadTodos();
    loadPrepaid();
    fetch("/api/services").then((r) => r.json()).then((d) => setServices(Array.isArray(d) ? d : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Admin only: remove the client and every record attached to them
  async function deleteClient() {
    if (!client) return;
    const warn = `Permanently delete ${client.name}?\n\nThis also removes their appointments, transaction history, packages and photos. This cannot be undone.`;
    if (!confirm(warn)) return;
    if (!confirm(`Last check — delete ${client.name} and all their records?`)) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Could not delete this client");
      return;
    }
    router.push("/admin/clients");
  }

  async function load() {
    const [c, cp, pkgs, ph, txs, vs] = await Promise.all([
      fetch(`/api/clients/${id}`).then((r) => r.json()),
      fetch(`/api/clients/${id}/packages`).then((r) => r.json()),
      fetch("/api/packages").then((r) => r.json()),
      fetch(`/api/clients/${id}/photos`).then((r) => r.json()),
      fetch(`/api/clients/${id}/transactions`).then((r) => r.json()),
      fetch(`/api/clients/${id}/appointments`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    setVisits(Array.isArray(vs) ? vs : []);
    setClient(c);
    setProfile({
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      dob: c.dob ? c.dob.slice(0, 10) : "",
      address: c.address || "",
      notes: c.notes || "",
    });
    setClientPackages(Array.isArray(cp) ? cp : []);
    setAvailablePackages(Array.isArray(pkgs) ? pkgs.filter((p: Package & { isActive: boolean }) => p.isActive) : []);
    setPhotos(Array.isArray(ph) ? ph : []);
    setTransactions(Array.isArray(txs) ? txs : []);
  }

  // A visit is a day they came in — several treatments that day are one
  // visit, not several
  const dayKey = (v: Visit) => v.startTime.slice(0, 10);
  const doneVisits = visits.filter(isDone);
  const sessions = Array.from(new Set(doneVisits.map(dayKey)));
  const statusPool =
    statusFilter === "all" ? visits
      : statusFilter === "upcoming" ? visits.filter(isUpcoming)
      : visits.filter((v) => v.status === statusFilter);
  const filteredVisits =
    visitFilter === "all" ? statusPool : statusPool.filter((v) => visitBucket(v) === visitFilter);

  // Same client, same day — shown as one visit listing everything done
  function groupByDay(rows: Visit[]): { key: string; rows: Visit[] }[] {
    const map = new Map<string, Visit[]>();
    for (const v of rows) {
      const k = dayKey(v);
      const list = map.get(k);
      if (list) list.push(v);
      else map.set(k, [v]);
    }
    return Array.from(map, ([key, rows]) => ({ key, rows }));
  }

  function statusCount(key: string) {
    if (key === "all") return visits.length;
    if (key === "upcoming") return visits.filter(isUpcoming).length;
    return visits.filter((v) => v.status === key).length;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profile.name,
        phone: profile.phone,
        email: profile.email || null,
        dob: profile.dob || null,
        address: profile.address || null,
        notes: profile.notes || null,
      }),
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
    load();
  }

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/clients/${id}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(txForm),
    });
    setTxForm({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", paid: true, reference: "" });
    load();
  }

  async function togglePaid(tx: Transaction) {
    await fetch(`/api/clients/${id}/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: !tx.paid }),
    });
    load();
  }

  async function deleteTransaction(txId: string) {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/clients/${id}/transactions/${txId}`, { method: "DELETE" });
    load();
  }

  useEffect(() => { load(); }, [id]);

  async function assignPackage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPkg) return;
    await fetch(`/api/clients/${id}/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageId: selectedPkg,
        notes: pkgNotes,
        paymentStatus: pkgPayMode,
        amountPaid: pkgPayMode === "PARTIAL" ? pkgPayAmount : undefined,
      }),
    });
    setShowAddPkg(false); setSelectedPkg(""); setPkgNotes("");
    setPkgPayMode("PAID"); setPkgPayAmount("");
    load();
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const { url } = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json());
    await fetch(`/api/clients/${id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, takenAt: photoDate, notes: photoNotes }),
    });
    setUploading(false); setPhotoNotes("");
    setPhotoDate(new Date().toISOString().slice(0, 10));
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function updatePhotoDate(photoId: string, takenAt: string) {
    if (!takenAt) return;
    await fetch(`/api/clients/${id}/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ takenAt }),
    });
    load();
  }

  async function deletePhoto(photoId: string) {
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/clients/${id}/photos/${photoId}`, { method: "DELETE" });
    load();
  }

  // Photos are stored exactly as uploaded, so this downloads the original quality
  function downloadPhoto(photo: Photo) {
    const mime = photo.url.match(/^data:([^;]+);/)?.[1] || "image/jpeg";
    const ext = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const a = document.createElement("a");
    a.href = photo.url;
    a.download = `${(client?.name || "client").replace(/\s+/g, "-")}-${photo.takenAt.slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (!client) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/admin/clients")} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-sm text-gray-500">{client.phone}{client.email ? ` · ${client.email}` : ""}</p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={deleteClient}>
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete client
          </Button>
        )}
      </div>

      {/* Still to do — unfinished work from a previous visit */}
      {(() => {
        const open = todos.filter((t) => !t.doneAt);
        return (
          <div className={`rounded-xl border-2 px-4 py-3 ${open.length ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
            <div className="flex items-center justify-between">
              <p className={`text-sm font-semibold ${open.length ? "text-amber-900" : "text-gray-500"}`}>
                {open.length ? `⚠ Still to do (${open.length})` : "Still to do — nothing pending"}
              </p>
              {!addingTodo && (
                <Button size="sm" variant="outline" onClick={() => setAddingTodo(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              )}
            </div>
            {addingTodo && (
              <div className="flex gap-2 mt-2">
                <input autoFocus className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-black"
                  placeholder="e.g. legs — from Full Body Laser"
                  value={newTodo} onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTodo(); } }} />
                <Button size="sm" onClick={addTodo} disabled={!newTodo.trim()}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingTodo(false); setNewTodo(""); }}>Cancel</Button>
              </div>
            )}
            {open.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {open.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-900 min-w-0">
                      <span className="font-medium">{t.description}</span>
                      {t.fromService && <span className="text-gray-500"> — from {t.fromService}</span>}
                      <span className="text-gray-400 text-xs"> · {format(new Date(t.createdAt), "MMM d, yyyy")}</span>
                    </span>
                    <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => markTodoDone(t.id)}>
                      Mark done
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {(["record", "visits", "packages", "photos"] as const).map((t) => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${tab === t ? "border-pink-600 text-pink-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "record" ? "📋 Record" : t === "visits" ? `💉 Visits (${sessions.length})` : t === "packages" ? "📦 Packages" : "📸 Photos"}
          </button>
        ))}
      </div>

      {/* Client Record tab */}
      {tab === "record" && (
        <div className="space-y-4">
          {/* Profile */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Profile</CardTitle>
                <Button size="sm" onClick={saveProfile}>{profileSaved ? "✓ Saved!" : "Save"}</Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 min-h-[70px]" value={profile.notes} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} placeholder="Allergies, preferences, skin type…" />
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Paid up front, nothing booked yet */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Paid in Advance</CardTitle>
                <Button size="sm" variant={showPrepaidForm ? "outline" : "default"}
                  onClick={() => { setShowPrepaidForm(!showPrepaidForm); resetPrepaidForm(); }}>
                  {showPrepaidForm ? "Cancel" : <><Plus className="w-4 h-4 mr-1" /> Add</>}
                </Button>
              </div>
              <p className="text-sm text-gray-500">Paid for, waiting to be booked</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {showPrepaidForm && (
                <form onSubmit={addPrepaid} className="space-y-3 border border-gray-200 rounded-xl p-3 bg-gray-50">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      What did they pay for? <span className="font-normal text-gray-400">(tick as many as you need)</span>
                    </label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 mb-1.5"
                      placeholder="Search services… e.g. ce for Cellulite"
                      value={ppSearch} onChange={(e) => setPpSearch(e.target.value)} />
                    <div className="border border-gray-200 rounded-lg max-h-36 overflow-y-auto divide-y divide-gray-100 bg-white">
                      {(() => {
                        const q = ppSearch.trim().toLowerCase();
                        const shown = q
                          ? services.filter((sv) => sv.name.toLowerCase().includes(q) || ppPicked[sv.id])
                          : services;
                        if (shown.length === 0) {
                          return <p className="px-3 py-3 text-sm text-gray-400 text-center">No service matches — use &quot;something else&quot; below</p>;
                        }
                        return shown.map((sv) => {
                          const on = !!ppPicked[sv.id];
                          return (
                            <button key={sv.id} type="button" onClick={() => togglePpService(sv)}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${on ? "bg-pink-50 text-pink-800" : "hover:bg-gray-50 text-gray-800"}`}>
                              <span>{on ? "\u2713 " : ""}{sv.name}</span>
                              {sv.price != null ? <span className="text-xs text-gray-400">${sv.price}</span> : null}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* How the money is being entered */}
                  {Object.keys(ppPicked).length > 1 && (
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { key: "each", title: "A price each", note: "Set what every service cost" },
                        { key: "bundle", title: "One price for all", note: "A single figure for the lot" },
                      ] as const).map((opt) => (
                        <label key={opt.key}
                          className={`flex items-start gap-2 border rounded-xl px-3 py-2 cursor-pointer transition-colors ${ppMode === opt.key ? "border-pink-600 bg-pink-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                          <input type="radio" name="ppmode" className="mt-0.5"
                            checked={ppMode === opt.key} onChange={() => setPpMode(opt.key)} />
                          <span>
                            <span className="block text-sm font-medium text-gray-900">{opt.title}</span>
                            <span className="block text-xs text-gray-500">{opt.note}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* One row per ticked service, each with its own deal */}
                  {Object.keys(ppPicked).length > 0 && (
                    <div className="space-y-2">
                      {Object.entries(ppPicked).map(([sid, row]) => {
                        const sv = services.find((x) => x.id === sid);
                        const n = Math.max(parseInt(row.sessions) || 1, 1);
                        const normally = sv?.price != null ? sv.price * n : null;
                        const total = parseFloat(row.amount) || 0;
                        return (
                          <div key={sid} className="border border-gray-200 rounded-lg px-3 py-2.5 bg-white">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="text-sm font-medium text-gray-900 truncate">{sv?.name}</p>
                              <button type="button" onClick={() => togglePpService({ id: sid, price: sv?.price ?? null })}
                                className="text-gray-300 hover:text-red-500 flex-shrink-0">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Sessions</label>
                                <input type="number" min={1} required
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900"
                                  value={row.sessions} onChange={(e) => setPpField(sid, "sessions", e.target.value)} />
                              </div>
                              {ppMode === "each" ? (
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Paid ($)</label>
                                  <input type="number" step="0.01" min={0} required
                                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900"
                                    value={row.amount} onChange={(e) => setPpField(sid, "amount", e.target.value)} />
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Share of the total</label>
                                  <p className="px-2 py-1.5 text-sm text-gray-500">
                                    ${(splitBundle(parseFloat(ppBundle) || 0)[sid] ?? 0).toFixed(2)}
                                  </p>
                                </div>
                              )}
                            </div>
                            {ppMode === "each" && total > 0 && normally != null && normally !== total && (
                              <p className="text-xs mt-1.5">
                                <span className="text-gray-500">{n} \u00d7 ${(total / n).toFixed(2)} each · </span>
                                <span className={normally > total ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                                  normally ${normally.toFixed(2)}
                                  {normally > total ? ` — saves $${(normally - total).toFixed(2)}` : ""}
                                </span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                      {ppMode === "bundle" ? (
                        <div className="border-t border-gray-200 pt-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            One price for all {Object.keys(ppPicked).length} services ($) *
                          </label>
                          <input type="number" step="0.01" min={0} required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                            placeholder="e.g. 150" value={ppBundle} onChange={(e) => setPpBundle(e.target.value)} />
                          {(() => {
                            const listed = Object.entries(ppPicked).reduce((sum, [sid, row]) => {
                              const unit = services.find((x) => x.id === sid)?.price;
                              return sum + (unit != null ? unit * Math.max(parseInt(row.sessions) || 1, 1) : 0);
                            }, 0);
                            if (!ppTotal || !listed || listed === ppTotal) return null;
                            return (
                              <p className={`text-xs mt-1 font-medium ${listed > ppTotal ? "text-green-600" : "text-amber-600"}`}>
                                Normally ${listed.toFixed(2)}
                                {listed > ppTotal ? ` — saves $${(listed - ppTotal).toFixed(2)}` : ""}
                              </p>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                          <span className="text-gray-600">
                            {Object.keys(ppPicked).length} service{Object.keys(ppPicked).length > 1 ? "s" : ""}
                          </span>
                          <span className="font-semibold text-gray-900">Total ${ppTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Anything not on the service list */}
                  {Object.keys(ppPicked).length === 0 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">…or something else</label>
                        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                          placeholder="e.g. Bridal package, gift voucher"
                          value={ppOther} onChange={(e) => setPpOther(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">How many sessions? *</label>
                          <input type="number" min={1} required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                            value={ppSessions} onChange={(e) => setPpSessions(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Total paid ($) *</label>
                          <input type="number" step="0.01" min={0} required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                            value={ppAmount} onChange={(e) => setPpAmount(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      placeholder="Optional" value={ppNotes} onChange={(e) => setPpNotes(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={ppPaid} onChange={(e) => setPpPaid(e.target.checked)} />
                    Money received
                  </label>
                  <Button type="submit" size="sm" disabled={savingPp || (Object.keys(ppPicked).length === 0 && !ppOther.trim())}>
                    {savingPp ? "Saving…" : "Save"}
                  </Button>
                </form>
              )}

              {prepaid.filter((pp) => !pp.usedAt).length === 0 && !showPrepaidForm ? (
                <p className="text-center text-gray-400 py-4 text-sm">Nothing paid in advance</p>
              ) : (
                <div className="space-y-2">
                  {groupPrepaid(prepaid.filter((pp) => !pp.usedAt)).map(({ key, rows }) => {
                    const total = rows.reduce((s, r) => s + r.amount, 0);
                    const left = rows.reduce((s, r) => s + Math.max(r.sessionsTotal - r.sessionsUsed, 0), 0);
                    const all = rows.reduce((s, r) => s + r.sessionsTotal, 0);
                    const bundle = rows.length > 1;
                    return (
                      <div key={key} className="border border-amber-200 bg-amber-50 rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {rows.map((r) => r.service?.name || r.description).join(" + ")}
                              <span className="text-gray-500 font-normal">
                                {" · "}{all} session{all !== 1 ? "s" : ""} for ${total.toFixed(2)}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(rows[0].createdAt), "d MMMM, yyyy")}
                              {rows[0].notes ? ` · ${rows[0].notes}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={left > 0 ? "success" : "outline"}>{left} of {all} left</Badge>
                            {rows.some((r) => !r.paid) && <Badge variant="warning">unpaid</Badge>}
                            <Button size="sm" variant="outline" onClick={() => markGroupDone(rows, true)}>Done</Button>
                            {isAdmin && (
                              <button onClick={() => deletePrepaid(rows)} className="text-gray-300 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Each treatment in the deal, so it's clear what's left of what */}
                        {bundle && (
                          <div className="mt-2 space-y-1 border-t border-amber-200 pt-2">
                            {rows.map((r) => {
                              const rLeft = Math.max(r.sessionsTotal - r.sessionsUsed, 0);
                              return (
                                <div key={r.id} className="flex items-center justify-between text-xs">
                                  <span className="text-gray-700">{r.service?.name || r.description}</span>
                                  <span className={rLeft > 0 ? "text-gray-600" : "text-gray-400 line-through"}>
                                    {rLeft} of {r.sessionsTotal} left
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {!bundle && rows[0].sessionsTotal > 1 && (
                          <div className="w-full bg-white/70 rounded-full h-1.5 mt-2">
                            <div className="bg-amber-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${(rows[0].sessionsUsed / rows[0].sessionsTotal) * 100}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Already used */}
              {prepaid.some((pp) => pp.usedAt) && (
                <details>
                  <summary className="text-xs text-gray-500 cursor-pointer">
                    {prepaid.filter((pp) => pp.usedAt).length} already used
                  </summary>
                  <div className="space-y-1.5 mt-2">
                    {prepaid.filter((pp) => pp.usedAt).map((pp) => (
                      <div key={pp.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2">
                        <p className="text-sm text-gray-500 line-through">{pp.service?.name || pp.description}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-400">${pp.amount.toFixed(2)}</span>
                          <Button size="sm" variant="ghost" onClick={() => togglePrepaidUsed(pp)}>Undo</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>

          {/* Transaction history */}
          <Card>
            <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Add row */}
              <form onSubmit={addTransaction} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input type="date" required className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} />
                </div>
                <div className="col-span-2 md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <input required className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900" placeholder="e.g. Laser session, package payment…" value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
                  <input type="number" step="0.01" required className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reference</label>
                  <input className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900" placeholder="Optional" value={txForm.reference} onChange={(e) => setTxForm({ ...txForm, reference: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-gray-600">
                    <input type="checkbox" checked={txForm.paid} onChange={(e) => setTxForm({ ...txForm, paid: e.target.checked })} />
                    Paid
                  </label>
                  <Button type="submit" size="sm"><Plus className="w-4 h-4" /></Button>
                </div>
              </form>

              {/* Table */}
              {transactions.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">No transactions yet</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Paid</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Reference</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{format(new Date(tx.date), "d MMMM, yyyy")}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{tx.description}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">${tx.amount.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => togglePaid(tx)} title="Click to toggle">
                                <Badge variant={tx.paid ? "success" : "warning"}>{tx.paid ? "✓ Paid" : "Unpaid"}</Badge>
                              </button>
                            </td>
                            <td className="px-3 py-2 text-gray-500">{tx.reference || "—"}</td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => deleteTransaction(tx.id)} className="text-gray-300 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-6 text-sm border-t border-gray-100 pt-3">
                    <span className="text-gray-500">Total: <span className="font-semibold text-gray-900">${transactions.reduce((s, t) => s + t.amount, 0).toFixed(2)}</span></span>
                    {transactions.some((t) => !t.paid) && (
                      <span className="text-gray-500">Unpaid: <span className="font-semibold text-amber-600">${transactions.filter((t) => !t.paid).reduce((s, t) => s + t.amount, 0).toFixed(2)}</span></span>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions tab — every visit, filtered by service type */}
      {tab === "visits" && (
        <div className="space-y-4">
          {/* What happened */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => {
              const count = statusCount(f.key);
              const on = statusFilter === f.key;
              const isUpcoming = f.key === "upcoming";
              return (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    on
                      ? isUpcoming ? "bg-gray-700 border-gray-700 text-white" : "bg-pink-600 border-pink-600 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-pink-300"
                  }`}>
                  {f.label} <span className={on ? "text-white/70" : "text-gray-400"}>({count})</span>
                </button>
              );
            })}
          </div>

          {/* Which treatment */}
          <div className="flex flex-wrap gap-2">
            {VISIT_FILTERS.map((f) => {
              const count = f.key === "all" ? statusPool.length : statusPool.filter((v) => visitBucket(v) === f.key).length;
              const on = visitFilter === f.key;
              return (
                <button key={f.key} onClick={() => setVisitFilter(f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${on ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}>
                  {f.label} <span className={on ? "text-white/70" : "text-gray-400"}>({count})</span>
                </button>
              );
            })}
          </div>

          {/* What this filter adds up to */}
          {filteredVisits.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">
                  {statusFilter === "upcoming" ? "Booked" : statusFilter === "all" ? "Bookings" : "Showing"}
                </p>
                <p className="text-xl font-bold text-gray-900">{filteredVisits.length}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Done</p>
                <p className="text-xl font-bold text-green-600">{filteredVisits.filter((v) => v.status === "COMPLETED").length}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Paid</p>
                <p className="text-xl font-bold text-gray-900">
                  ${filteredVisits.reduce((s, v) => s + (v.amountPaid || 0), 0).toFixed(2)}
                </p>
              </CardContent></Card>
            </div>
          )}

          {filteredVisits.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-gray-400 text-sm">
              {visits.length === 0
                ? "No bookings yet"
                : statusFilter === "upcoming"
                ? "Nothing booked ahead"
                : "Nothing matches these filters"}
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {groupByDay(filteredVisits).map(({ key, rows }) => {
                const paid = rows.reduce((s, v) => s + (v.amountPaid || 0), 0);
                return (
                  <div key={key} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          {format(new Date(rows[0].startTime), "d MMMM, yyyy")}
                          {rows.length > 1 && (
                            <span className="font-normal text-gray-500"> · {rows.length} treatments</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(rows[0].startTime), "h:mm a")}
                          {rows[0].staff ? ` · ${rows[0].staff.name}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {paid > 0 && <Badge variant="success">${paid.toFixed(2)}</Badge>}
                      </div>
                    </div>

                    {/* Everything done that day */}
                    <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
                      {rows.map((v) => (
                        <div key={v.id} className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <span className="text-sm text-gray-800">{v.service.name}</span>
                            {v.notes && <span className="text-xs text-gray-400 ml-1.5">{v.notes}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {v.clientPackageId ? (
                              <Badge variant="default">Package</Badge>
                            ) : v.amountPaid != null ? (
                              <Badge variant={v.paymentStatus === "PAID" ? "success" : "warning"}>
                                ${v.amountPaid.toFixed(2)}
                              </Badge>
                            ) : null}
                            <Badge variant={
                              v.status === "COMPLETED" ? "success"
                                : v.status === "NO_SHOW" || v.status === "CANCELLED" ? "destructive"
                                : "outline"
                            }>
                              {v.status === "NO_SHOW" ? "No-show" : v.status.charAt(0) + v.status.slice(1).toLowerCase()}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Packages tab */}
      {tab === "packages" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{clientPackages.length} package{clientPackages.length !== 1 ? "s" : ""}</p>
            <Button size="sm" onClick={() => setShowAddPkg(true)}><Plus className="w-4 h-4 mr-1" /> Assign Package</Button>
          </div>

          {showAddPkg && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Assign Package</CardTitle>
                  <button onClick={() => setShowAddPkg(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={assignPackage} className="space-y-3">
                  <Select value={selectedPkg} onChange={(e) => setSelectedPkg(e.target.value)} required>
                    <option value="">Select package…</option>
                    {availablePackages.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sessionCount} sessions · ${p.price})</option>
                    ))}
                  </Select>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-black"
                    placeholder="Notes (optional)"
                    value={pkgNotes}
                    onChange={(e) => setPkgNotes(e.target.value)}
                  />
                  {/* Payment for the package */}
                  <div className="space-y-2">
                    {([
                      { value: "PAID", label: `Paid in full${selectedPkg ? ` ($${availablePackages.find((p) => p.id === selectedPkg)?.price ?? ""})` : ""}` },
                      { value: "PARTIAL", label: "Partially paid" },
                      { value: "UNPAID", label: "Not paid" },
                    ] as const).map((opt) => (
                      <label key={opt.value}
                        className={`flex items-center gap-3 border rounded-xl px-4 py-2.5 cursor-pointer transition-colors ${pkgPayMode === opt.value ? "border-pink-600 bg-pink-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <input type="radio" name="pkgpay" checked={pkgPayMode === opt.value} onChange={() => setPkgPayMode(opt.value)} />
                        <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                      </label>
                    ))}
                    {pkgPayMode === "PARTIAL" && (
                      <div className="pl-1">
                        <label className="block text-xs text-gray-500 mb-1">Amount paid ($)</label>
                        <input type="number" step="0.01" min={0}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-black"
                          value={pkgPayAmount} onChange={(e) => setPkgPayAmount(e.target.value)} placeholder="e.g. 100" />
                        {pkgPayAmount && selectedPkg && (
                          <p className="text-xs text-amber-600 mt-1">
                            Balance due: ${((availablePackages.find((p) => p.id === selectedPkg)?.price || 0) - parseFloat(pkgPayAmount || "0")).toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button type="submit" disabled={pkgPayMode === "PARTIAL" && (!pkgPayAmount || parseFloat(pkgPayAmount) <= 0)}>Assign</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {clientPackages.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-gray-400"><Package className="w-10 h-10 mx-auto mb-2 opacity-30" />No packages assigned</CardContent></Card>
          ) : (
            clientPackages.map((cp) => {
              const remaining = cp.sessionsTotal - cp.sessionsUsed;
              const pct = (cp.sessionsUsed / cp.sessionsTotal) * 100;
              return (
                <Card key={cp.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{cp.package.name}</p>
                        <p className="text-sm text-gray-500">
                          {(cp.package.services?.length
                            ? cp.package.services.map((s) => s.name)
                            : [cp.package.service.name]
                          ).join(" · ")}
                        </p>
                      </div>
                      <Badge variant={remaining > 0 ? "success" : "outline"}>
                        {remaining} / {cp.sessionsTotal} left
                      </Badge>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                      <div className="bg-pink-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-gray-400 flex justify-between mb-3">
                      <span>Purchased {format(new Date(cp.purchasedAt), "MMM d, yyyy")}</span>
                      {cp.expiresAt && <span>Expires {format(new Date(cp.expiresAt), "MMM d, yyyy")}</span>}
                    </div>
                    {cp.appointments.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Session history</p>
                        <div className="space-y-1">
                          {cp.appointments.map((a, i) => (
                            <div key={a.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                              <span>Session {i + 1} · {format(new Date(a.startTime), "MMM d, yyyy")}</span>
                              <Badge variant={a.status === "COMPLETED" ? "success" : "outline"}>{a.status}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Photos tab */}
      {tab === "photos" && (
        <div className="space-y-4">
          {/* Upload section */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Upload Photo</p>
              <div className="flex gap-3 flex-wrap items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Photo date</label>
                  <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-black"
                    value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-black" placeholder="Optional notes" value={photoNotes} onChange={(e) => setPhotoNotes(e.target.value)} />
                </div>
                <label className="cursor-pointer">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
                  <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-1" /> {uploading ? "Uploading…" : "Choose Photo"}
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          {photos.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-gray-400"><Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />No photos yet</CardContent></Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="rounded-xl overflow-hidden border border-gray-200">
                  <div className="relative group cursor-pointer" onClick={() => setLightbox(photo)}>
                    <img src={photo.url} alt={photo.notes || "client photo"} className="w-full h-40 object-cover" />
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="bg-gray-900/70 text-white rounded-full w-6 h-6 flex items-center justify-center"
                        title="Download original"
                        onClick={(e) => { e.stopPropagation(); downloadPhoto(photo); }}>
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {photo.notes && <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">{photo.notes}</p>}
                  </div>
                  {/* Date stamp — editable so progress stays accurate */}
                  <input type="date"
                    className="w-full text-xs text-gray-600 px-2 py-1.5 border-t border-gray-100 bg-gray-50"
                    value={photo.takenAt.slice(0, 10)}
                    onChange={(e) => updatePhotoDate(photo.id, e.target.value)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.notes || ""} className="w-full rounded-xl" />
            {lightbox.notes && <p className="text-white text-sm mt-2 text-center">{lightbox.notes}</p>}
            <p className="text-gray-400 text-xs text-center mt-1">{format(new Date(lightbox.takenAt), "MMMM d, yyyy")}</p>
            <div className="flex justify-center mt-3">
              <Button size="sm" variant="secondary" onClick={() => downloadPhoto(lightbox)}>
                <Download className="w-4 h-4 mr-1.5" /> Download original
              </Button>
            </div>
            <button className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center" onClick={() => setLightbox(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
