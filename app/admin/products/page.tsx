"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Pencil, Trash2, ShoppingBag, Minus } from "lucide-react";
import { productPrice } from "@/lib/pricing";

interface Product {
  id: string; name: string; brand: string | null; category: string | null;
  cost: number; price: number; discount: number | null;
  stock: number; lowStockAt: number; notes: string | null; isActive: boolean;
}

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

  async function load() {
    const d = await fetch("/api/products").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setProducts(Array.isArray(d) ? d : []);
  }

  useEffect(() => { load(); }, []);

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
                    {/* Stock counter */}
                    <div className="flex items-center gap-1 border border-gray-200 rounded-lg">
                      <button onClick={() => changeStock(p, -1)} className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 rounded-l-lg" title="Sold one">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className={`px-2 text-sm font-semibold tabular-nums ${low ? "text-amber-600" : "text-gray-900"}`}>
                        {p.stock}
                      </span>
                      <button onClick={() => changeStock(p, 1)} className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 rounded-r-lg" title="Received one">
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
    </div>
  );
}
