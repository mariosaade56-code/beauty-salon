// Salon-wide discount on services, set once in Settings and applied
// everywhere a service price is shown or charged.

export const SERVICE_DISCOUNT_KEY = "service_discount_percent";

/** Reads a percentage from settings, clamped to 0–100. 0 means no discount. */
export function discountPercent(settings: Record<string, string> | undefined): number {
  const raw = parseFloat(settings?.[SERVICE_DISCOUNT_KEY] ?? "");
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, 100);
}

/** Applies a percentage off, rounded to the cent. */
export function applyDiscount(price: number, percent: number): number {
  if (!percent || !price) return price;
  return Math.round(price * (1 - percent / 100) * 100) / 100;
}

/** Final price a client pays for a product, after its own discount. */
export function productPrice(p: { price: number; discount?: number | null }): number {
  return applyDiscount(p.price, p.discount ?? 0);
}
