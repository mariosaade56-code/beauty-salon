// Opens WhatsApp with a message ready to send. No API account needed —
// it's the same wa.me link you'd get from sharing a chat.

export const BIRTHDAY_MESSAGE_KEY = "birthday_message";
export const COUNTRY_CODE_KEY = "whatsapp_country_code";

export const DEFAULT_BIRTHDAY_MESSAGE =
  "Happy Birthday {name}! 🎉 Wishing you a beautiful year ahead. With love, Divine Skin 💕";

/**
 * Turns a locally-written number into the international form wa.me needs.
 * Numbers already carrying a country code (00…, +…, or the code itself)
 * are left alone; short local ones get it prefixed.
 */
export function toWhatsappNumber(phone: string, countryCode = "961"): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(countryCode) && digits.length > countryCode.length + 5) return digits;
  // Local numbers are often written with a leading 0
  digits = digits.replace(/^0+/, "");
  return countryCode + digits;
}

export function birthdayLink(
  phone: string,
  name: string,
  template = DEFAULT_BIRTHDAY_MESSAGE,
  countryCode = "961"
): string {
  const number = toWhatsappNumber(phone, countryCode);
  const text = (template || DEFAULT_BIRTHDAY_MESSAGE).replace(/\{name\}/g, name.split(" ")[0] || name);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
