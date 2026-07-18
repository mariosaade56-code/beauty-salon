"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ChevronLeft, Package, Camera, Trash2, Plus, X, Download } from "lucide-react";

interface Package { id: string; name: string; sessionCount: number; price: number; service: { name: string }; }
interface ClientPackage {
  id: string; sessionsTotal: number; sessionsUsed: number; purchasedAt: string; expiresAt: string | null; notes: string | null;
  package: { name: string; service: { name: string; category: string }; };
  appointments: { id: string; startTime: string; status: string }[];
}
interface Photo { id: string; url: string; type: string; notes: string | null; takenAt: string; }
interface Client { id: string; name: string; phone: string; email: string | null; notes: string | null; dob: string | null; address: string | null; createdAt: string; }
interface Transaction { id: string; date: string; description: string; amount: number; paid: boolean; reference: string | null; }


export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [clientPackages, setClientPackages] = useState<ClientPackage[]>([]);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<"record" | "packages" | "photos">("record");
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

  async function load() {
    const [c, cp, pkgs, ph, txs] = await Promise.all([
      fetch(`/api/clients/${id}`).then((r) => r.json()),
      fetch(`/api/clients/${id}/packages`).then((r) => r.json()),
      fetch("/api/packages").then((r) => r.json()),
      fetch(`/api/clients/${id}/photos`).then((r) => r.json()),
      fetch(`/api/clients/${id}/transactions`).then((r) => r.json()),
    ]);
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {(["record", "packages", "photos"] as const).map((t) => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${tab === t ? "border-pink-600 text-pink-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "record" ? "📋 Record" : t === "packages" ? "📦 Packages" : "📸 Photos"}
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
                  <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[70px]" value={profile.notes} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} placeholder="Allergies, preferences, skin type…" />
                </div>
              </form>
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
                  <input type="date" required className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} />
                </div>
                <div className="col-span-2 md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <input required className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" placeholder="e.g. Laser session, package payment…" value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
                  <input type="number" step="0.01" required className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reference</label>
                  <input className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" placeholder="Optional" value={txForm.reference} onChange={(e) => setTxForm({ ...txForm, reference: e.target.value })} />
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
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{format(new Date(tx.date), "MMM d, yyyy")}</td>
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
                        <p className="text-sm text-gray-500">{cp.package.service.name}</p>
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
