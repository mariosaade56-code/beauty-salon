"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ChevronLeft, Package, Camera, Trash2, Plus, X } from "lucide-react";

interface Package { id: string; name: string; sessionCount: number; price: number; service: { name: string }; }
interface ClientPackage {
  id: string; sessionsTotal: number; sessionsUsed: number; purchasedAt: string; expiresAt: string | null; notes: string | null;
  package: { name: string; service: { name: string; category: string }; };
  appointments: { id: string; startTime: string; status: string }[];
}
interface Photo { id: string; url: string; type: string; notes: string | null; takenAt: string; }
interface Client { id: string; name: string; phone: string; email: string | null; notes: string | null; createdAt: string; }

const PHOTO_TYPES = ["BEFORE", "AFTER", "GENERAL"];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [clientPackages, setClientPackages] = useState<ClientPackage[]>([]);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tab, setTab] = useState<"packages" | "photos">("packages");
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState("");
  const [pkgNotes, setPkgNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoType, setPhotoType] = useState("GENERAL");
  const [photoNotes, setPhotoNotes] = useState("");
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [c, cp, pkgs, ph] = await Promise.all([
      fetch(`/api/clients/${id}`).then((r) => r.json()),
      fetch(`/api/clients/${id}/packages`).then((r) => r.json()),
      fetch("/api/packages").then((r) => r.json()),
      fetch(`/api/clients/${id}/photos`).then((r) => r.json()),
    ]);
    setClient(c);
    setClientPackages(Array.isArray(cp) ? cp : []);
    setAvailablePackages(Array.isArray(pkgs) ? pkgs.filter((p: Package & { isActive: boolean }) => p.isActive) : []);
    setPhotos(Array.isArray(ph) ? ph : []);
  }

  useEffect(() => { load(); }, [id]);

  async function assignPackage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPkg) return;
    await fetch(`/api/clients/${id}/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: selectedPkg, notes: pkgNotes }),
    });
    setShowAddPkg(false); setSelectedPkg(""); setPkgNotes("");
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
      body: JSON.stringify({ url, type: photoType, notes: photoNotes }),
    });
    setUploading(false); setPhotoNotes("");
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function deletePhoto(photoId: string) {
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/clients/${id}/photos/${photoId}`, { method: "DELETE" });
    load();
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
      <div className="flex gap-1 border-b border-gray-200">
        {(["packages", "photos"] as const).map((t) => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? "border-pink-600 text-pink-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "packages" ? "📦 Packages" : "📸 Photos"}
          </button>
        ))}
      </div>

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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Notes (optional)"
                    value={pkgNotes}
                    onChange={(e) => setPkgNotes(e.target.value)}
                  />
                  <Button type="submit">Assign</Button>
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
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <Select value={photoType} onChange={(e) => setPhotoType(e.target.value)}>
                    {PHOTO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Optional notes" value={photoNotes} onChange={(e) => setPhotoNotes(e.target.value)} />
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
                <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-gray-200 cursor-pointer" onClick={() => setLightbox(photo)}>
                  <img src={photo.url} alt={photo.notes || photo.type} className="w-full h-40 object-cover" />
                  <div className="absolute top-2 left-2">
                    <Badge variant={photo.type === "BEFORE" ? "warning" : photo.type === "AFTER" ? "success" : "outline"}>
                      {photo.type}
                    </Badge>
                  </div>
                  <button
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {photo.notes && <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">{photo.notes}</p>}
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
            <button className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center" onClick={() => setLightbox(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
