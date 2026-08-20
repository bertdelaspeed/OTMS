import type { Lang } from "./i18n";

let LOCALE = "en-GB";

export function setDateLocale(lang: Lang): void {
  LOCALE = lang === "fr" ? "fr-FR" : "en-GB";
}

export function getLocale(): string {
  return LOCALE;
}

export function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}

export function spanDays(start: string, end: string | null): number {
  return daysBetween(start, end ?? start) + 1;
}

export function coversToday(e: { date: string; endDate: string | null }): boolean {
  const t = todayISO();
  return e.date <= t && (e.endDate ?? e.date) >= t;
}

/* ---------- locale-aware formatting ---------- */

export function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" }).format(fromISO(iso));
}

export function fmtDateYear(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" }).format(
    fromISO(iso)
  );
}

export function fmtDateFull(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fromISO(iso));
}

export function weekdayLetter(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "narrow" }).format(fromISO(iso));
}

export function weekdayShort(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "short" }).format(fromISO(iso));
}

export function monthTitle(iso: string): string {
  const s = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" }).format(fromISO(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthShort(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { month: "short" }).format(fromISO(iso));
}

export function dayNum(iso: string): number {
  return fromISO(iso).getDate();
}

/* ---------- calendar helpers ---------- */

export function weekNumber(iso: string): number {
  const d = fromISO(iso);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

/** Monday of the week containing iso. */
export function startOfWeekISO(iso: string): string {
  const d = fromISO(iso);
  const shift = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - shift);
  return toISO(d);
}

export function addMonthsISO(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

export function firstOfMonthISO(year: number, month0: number): string {
  return toISO(new Date(year, month0, 1));
}

export function monthOfISO(iso: string): { year: number; month0: number } {
  const d = fromISO(iso);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

/** 42 day-cells (6 weeks, Monday-first) covering the month. */
export function monthGridISO(year: number, month0: number): string[] {
  const first = firstOfMonthISO(year, month0);
  const start = startOfWeekISO(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function sameMonthISO(a: string, b: string): boolean {
  const da = fromISO(a);
  const db = fromISO(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}

export function monthStartISO(iso: string): string {
  const { year, month0 } = monthOfISO(iso);
  return firstOfMonthISO(year, month0);
}

export function monthEndISO(iso: string): string {
  const { year, month0 } = monthOfISO(iso);
  return toISO(new Date(year, month0 + 1, 0));
}

/** Days of [eStart..eEnd] that fall inside [rStart..rEnd] (0 if none). */
export function overlapDays(
  eStart: string,
  eEnd: string | null,
  rStart: string,
  rEnd: string
): number {
  const s = eStart > rStart ? eStart : rStart;
  const rawEnd = eEnd ?? eStart;
  const e = rawEnd < rEnd ? rawEnd : rEnd;
  return e >= s ? daysBetween(s, e) + 1 : 0;
}

export function relTime(isoDateTime: string): string {
  const diff = Date.now() - new Date(isoDateTime).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return LOCALE === "fr-FR" ? "à l’instant" : "just now";
  if (m < 60) return LOCALE === "fr-FR" ? `il y a ${m} min` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return LOCALE === "fr-FR" ? `il y a ${h} h` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return LOCALE === "fr-FR" ? `il y a ${d} j` : `${d}d ago`;
  return fmtDate(toISO(new Date(isoDateTime)));
}

export type DueTone = "late" | "today" | "soon" | "later";

export function dueLabel(due: string): { text: string; tone: DueTone } {
  const n = daysBetween(todayISO(), due);
  const fr = LOCALE === "fr-FR";
  if (n < 0) return { text: fr ? `${-n} j de retard` : `${-n}d overdue`, tone: "late" };
  if (n === 0) return { text: fr ? "pour aujourd’hui" : "due today", tone: "today" };
  if (n === 1) return { text: fr ? "pour demain" : "due tomorrow", tone: "soon" };
  return { text: fr ? `dans ${n} j` : `in ${n}d`, tone: "later" };
}
