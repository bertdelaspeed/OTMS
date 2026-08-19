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

export function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(fromISO(iso));
}

export function fmtDateYear(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    fromISO(iso)
  );
}

export function fmtDateFull(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fromISO(iso));
}

export function weekdayLetter(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "narrow" }).format(fromISO(iso));
}

export function weekNumber(iso: string): number {
  const d = fromISO(iso);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

export function relTime(isoDateTime: string): string {
  const diff = Date.now() - new Date(isoDateTime).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return fmtDate(toISO(new Date(isoDateTime)));
}

export type DueTone = "late" | "today" | "soon" | "later";

export function dueLabel(due: string): { text: string; tone: DueTone } {
  const n = daysBetween(todayISO(), due);
  if (n < 0) return { text: `${-n}d overdue`, tone: "late" };
  if (n === 0) return { text: "due today", tone: "today" };
  if (n === 1) return { text: "due tomorrow", tone: "soon" };
  return { text: `in ${n}d`, tone: "later" };
}
