"use client";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Pencil, Trash2, ShoppingBag, Minus, DollarSign } from "lucide-react";
import { productPrice } from "@/lib/pricing";
import { format } from "date-fns";

interface Product {
  id: string; name: string; brand: string | null; category: string | null;
  cost: number; price: number; discount: number | null;
  stock: number; lowStockAt: number; notes: string | null; isActive: boolean;
}
interface Sale {
  id: string; quantity: number; unitPrice: number; total: number; paid: boolean;
  soldAt: string; notes: string | null;
  product: { name: string; brand: string | null };
  client: { id: string; name: string } | null;
}
interface ClientHit { id: string; name: string; phone: string; }

const blank = {
  name: "", brand: "", category: "", cost: "", price: "",
  discount: "", stock: "0", lowStockAt: "3", notes: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("STAFF");
  const isAdmin = role === "ADMIN";

  // Selling
  const [sellFor, setSellFor] = useState<Product | null>(null);
  const [sellQty, setSellQty] = useState("1");
  const [sellPrice, setSellPrice] = useState("");
  const [sellPaid, setSellPaid] = useState(true);
  const [sellClient, setSellClient] = useState<ClientHit | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientHits, setClientHits] = useState<ClientHit[]>([]);
  const [selling, setSelling] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    const [p, s] = await Promise.all([
      fetch("/api/products").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/product-sales").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setProducts(Array.isArray(p) ? p : []);
    setSales(Array.isArray(s) ? s : []);
  }

  useEffect(() => {
    load();
    fetch("/api/auth/me").then((r) => r.json()).then((u) => { if (u?.role) setRole(u.role); }).catch(() => {});
  }, []);

  function startSell(p: Product) {
    setSellFor(p);
    setSellQty("1");
    setSellPrice(String(productPrice(p)));
    setSellPaid(true);
    setSellClient(null);
    setClientQuery("");
    setClientHits([]);
  }

  function searchClients(q: string) {
    setClientQuery(q);
    setSellClient(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setClientHits([]); return; }
    searchTimer.current = setTimeout(async () => {
      const d = await fetch(`/api/clients?search=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : [])).catch(() => []);
      setClientHits(Array.isArray(d) ? d.slice(0, 5) : []);
    }, 250);
  }

  async function confirmSale() {
    if (!sellFor) return;
    setSelling(true);
    const res = await fetch("/api/product-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: sellFor.id,
        quantity: Number(sellQty) || 1,
        unitPrice: sellPrice,
        paid: sellPaid,
        clientId: sellClient?.id || null,
      }),
    }).catch(() => null);
    setSelling(false);
    if (!res || !res.ok) {
      const d = res ? await res.json().catch(() => ({})) : {};
      return alert(d.error || "Could not record the sale — please try again.");
    }
    setSellFor(null);
    load();
  }

  async function undoSale(s: Sale) {
    if (!confirm(`Undo the sale of ${s.product.name}? The stock goes back and the charge is removed.`)) return;
    await fetch(`/api/product-sales/${s.id}`, { method: "DELETE" });
    load();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = editId ? `/api/products/${editId}` : "/api/products";
    const res = await fetch(url, {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) return alert("Could not save the product — please try again.");
    setForm(blank); setShowForm(false); setEditId(null); load();
  }

  function startEdit(p: Product) {
    setForm({
      name: p.name, brand: p.brand || "", category: p.category || "",
      cost: String(p.cost), price: String(p.price),
      discount: p.discount != null ? String(p.discount) : "",
      stock: String(p.stock), lowStockAt: String(p.lowStockAt), notes: p.notes || "",
    });
    setEditId(p.id); setShowForm(true);
  }

  async function changeStock(p: Product, delta: number) {
    await fetch(`/api/products/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockDelta: delta }),
    });
    load();
  }

  async function remove(p: Product) {
    if (!confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    load();
  }

  // Money tied up in stock, and what it would bring in if it all sold
  const stockCost = products.reduce((s, p) => s + p.cost * p.stock, 0);
  const stockValue = products.reduce((s, p) => s + productPrice(p) * p.stock, 0);
  const lowStock = products.filter((p) => p.isActive && p.stock <= p.lowStockAt);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">Stock, cost and selling price</p>
        </div>
        <Button size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm(blank); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Product
        </Button>
      </div>

      {/* Summary */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-gray-500">Items in stock</p>
            <p className="text-xl font-bold text-gray-900">{products.reduce((s, p) => s + p.stock, 0)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-gray-500">Cost of stock</p>
            <p className="text-xl font-bold text-gray-900">${stockCost.toFixed(2)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-gray-500">Value if all sold</p>
            <p className="text-xl font-bold text-gray-900">${stockValue.toFixed(2)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-gray-500">Potential profit</p>
            <p className="text-xl font-bold text-green-600">${(stockValue - stockCost).toFixed(2)}</p>
          </CardContent></Card>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-xl px-4 py-3">
          <p className="font-semibold text-amber-800 text-sm">⚠ Running low ({lowStock.length})</p>
          <p className="text-sm text-amber-700 mt-1">
            {lowStock.map((p) => `${p.name} (${p.stock} left)`).join(" · ")}
          </p>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{editId ? "Edit Product" : "New Product"}</CardTitle>
              <button onClick={() => { setShowForm(false); setEditId(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Vitamin C Serum" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost — what you pay ($) *</label>
                <Input type="number" step="0.01" min={0} required value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="e.g. 12" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling price ($) *</label>
                <Input type="number" step="0.01" min={0} required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 25" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                <Input type="number" step="1" min={0} max={100} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="Leave empty for none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity in stock *</label>
                <Input type="number" min={0} required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warn me when stock reaches</label>
                <Input type="number" min={0} value={form.lowStockAt} onChange={(e) => setForm({ ...form, lowStockAt: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
              </div>

              {/* Live margin so pricing decisions are obvious */}
              {form.cost && form.price && (
                <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm">
                  {(() => {
                    const cost = parseFloat(form.cost) || 0;
                    const price = parseFloat(form.price) || 0;
                    const disc = parseFloat(form.discount) || 0;
                    const final = price * (1 - disc / 100);
                    const profit = final - cost;
                    return (
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <span className="text-gray-600">Client pays: <span className="font-semibold text-gray-900">${final.toFixed(2)}</span>
                          {disc > 0 && <span className="text-gray-400 line-through ml-1.5">${price.toFixed(2)}</span>}
                        </span>
                        <span className="text-gray-600">Profit per item:{" "}
                          <span className={`font-semibold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>${profit.toFixed(2)}</span>
                        </span>
                        {final > 0 && (
                          <span className="text-gray-600">Margin: <span className="font-semibold text-gray-900">{((profit / final) * 100).toFixed(0)}%</span></span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="md:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : editId ? "Update Product" : "Add Product"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No products yet. Add one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {products.map((p) => {
            const final = productPrice(p);
            const profit = final - p.cost;
            const low = p.stock <= p.lowStockAt;
            return (
              <div key={p.id}
                className={`border rounded-xl px-4 py-3 ${p.isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200 opacity-70"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {p.name}
                      {p.brand && <span className="font-normal text-gray-400 text-sm ml-1.5">{p.brand}</span>}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Cost ${p.cost.toFixed(2)} →{" "}
                      <span className="font-semibold text-gray-900">${final.toFixed(2)}</span>
                      {p.discount ? (
                        <>
                          <span className="line-through text-gray-400 ml-1.5">${p.price.toFixed(2)}</span>
                          <Badge variant="warning" className="ml-1.5">-{p.discount}%</Badge>
                        </>
                      ) : null}
                      <span className={`ml-2 ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ({profit >= 0 ? "+" : ""}${profit.toFixed(2)} profit)
                      </span>
                    </p>
                    {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" onClick={() => startSell(p)} disabled={p.stock < 1}>
                      <DollarSign className="w-4 h-4 mr-0.5" /> Sell
                    </Button>
                    {/* Stock counter — for corrections and deliveries, not sales */}
                    <div className="flex items-center gap-1 border border-gray-200 rounded-lg">
                      <button onClick={() => changeStock(p, -1)} className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 rounded-l-lg" title="Correct the count down">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className={`px-2 text-sm font-semibold tabular-nums ${low ? "text-amber-600" : "text-gray-900"}`}>
                        {p.stock}
                      </span>
                      <button onClick={() => changeStock(p, 1)} className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 rounded-r-lg" title="New stock arrived">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {low && <Badge variant="warning">Low</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => startEdit(p)}><Pencil className="w-4 h-4" /></Button>
                    <button onClick={() => remove(p)} className="text-gray-300 hover:text-red-500 px-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent sales */}
      {sales.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sales.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {s.product.name}{s.quantity > 1 ? ` × ${s.quantity}` : ""}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(s.soldAt), "d MMMM, yyyy")}
                      {s.client ? ` · ${s.client.name}` : " · walk-in"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={s.paid ? "success" : "warning"}>
                      {s.paid ? `$${s.total.toFixed(2)}` : `$${s.total.toFixed(2)} unpaid`}
                    </Badge>
                    {isAdmin && (
                      <button onClick={() => undoSale(s)} className="text-gray-300 hover:text-red-500" title="Undo this sale">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Record a sale */}
      {sellFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sell {sellFor.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{sellFor.stock} in stock</p>
              </div>
              <button onClick={() => setSellFor(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <Input type="number" min={1} max={sellFor.stock} value={sellQty}
                  onChange={(e) => setSellQty(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price each ($)</label>
                <Input type="number" step="0.01" min={0} value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)} />
              </div>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client <span className="font-normal text-gray-400">(leave empty for a walk-in)</span>
              </label>
              <Input value={sellClient ? sellClient.name : clientQuery} autoComplete="off"
                placeholder="Type a name or phone…"
                onChange={(e) => searchClients(e.target.value)} />
              {sellClient && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Will be added to {sellClient.name}&apos;s file
                </p>
              )}
              {!sellClient && clientHits.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {clientHits.map((c) => (
                    <button key={c.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-pink-50"
                      onClick={() => { setSellClient(c); setClientHits([]); }}>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {([
                { value: true, label: "Paid now" },
                { value: false, label: "Not paid yet" },
              ] as const).map((opt) => (
                <label key={String(opt.value)}
                  className={`flex items-center gap-3 border rounded-xl px-4 py-2.5 cursor-pointer transition-colors ${sellPaid === opt.value ? "border-pink-600 bg-pink-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name="sellpaid" checked={sellPaid === opt.value} onChange={() => setSellPaid(opt.value)} />
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                </label>
              ))}
            </div>

            {/* What this sale comes to */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm">
              {(() => {
                const qty = Math.max(Number(sellQty) || 1, 1);
                const each = parseFloat(sellPrice) || 0;
                const total = each * qty;
                const profit = total - sellFor.cost * qty;
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total</span>
                    <span className="text-right">
                      <span className="font-semibold text-gray-900 text-base">${total.toFixed(2)}</span>
                      <span className={`block text-xs ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {profit >= 0 ? "+" : ""}${profit.toFixed(2)} profit
                      </span>
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSellFor(null)}>Cancel</Button>
              <Button className="flex-1" onClick={confirmSale}
                disabled={selling || Number(sellQty) > sellFor.stock || Number(sellQty) < 1}>
                {selling ? "Saving…" : "Record Sale"}
              </Button>
            </div>
            {Number(sellQty) > sellFor.stock && (
              <p className="text-xs text-red-500 text-center">Only {sellFor.stock} in stock</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
