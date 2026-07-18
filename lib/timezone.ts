// All salon times are Lebanese wall-clock time, regardless of where the
// server runs (Vercel = UTC). These helpers convert between Beirut wall
// time and real UTC instants — DST included — using the Intl timezone db.
const TZ = "Asia/Beirut";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});

function wallParts(at: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(at).map((x) => [x.type, x.value]));
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour % 24, minute: +p.minute, second: +p.second,
  };
}

function offsetMs(at: Date): number {
  const w = wallParts(at);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - at.getTime();
}

/** Parse "yyyy-MM-dd" or "yyyy-MM-ddTHH:mm[:ss]" as Beirut wall time → UTC instant */
export function beirutToUtc(local: string): Date {
  const [d, t] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh = 0, mm = 0, ss = 0] = t ? t.split(":").map(Number) : [];
  const guess = Date.UTC(y, m - 1, day, hh, mm, ss || 0);
  let off = offsetMs(new Date(guess));
  off = offsetMs(new Date(guess - off)); // second pass handles DST edges
  return new Date(guess - off);
}

/** Parse an incoming appointment time: explicit-zone strings as-is, naive strings as Beirut */
export function parseSalonTime(s: string): Date {
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? new Date(s) : beirutToUtc(s);
}

/** UTC window covering one Beirut calendar day */
export function beirutDayRange(dateStr: string): { gte: Date; lt: Date } {
  const start = beirutToUtc(`${dateStr.slice(0, 10)}T00:00:00`);
  return { gte: start, lt: new Date(start.getTime() + 86400000) };
}

/** "HH:mm" Beirut wall-clock label for a UTC instant */
export function beirutHHmm(at: Date): string {
  const w = wallParts(at);
  return `${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`;
}

/** Beirut calendar date "yyyy-MM-dd" of a UTC instant */
export function beirutDateStr(at: Date): string {
  const w = wallParts(at);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** Human-readable formatting in Beirut time (for WhatsApp messages etc.) */
export function beirutFormat(at: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(at);
}
