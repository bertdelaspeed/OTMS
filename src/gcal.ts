import type { AppState, Task } from "./types";
import { addDays, fmtDateYear } from "./dates";
import { env } from "./env";

const TOKEN_KEY = "rollcall.gcal.token.v1";
const LINKS_KEY = "rollcall.gcal.links.v1";
const CFG_KEY = "rollcall.gcal.cfg.v1";
const SCOPES =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

export interface GcalToken {
  accessToken: string;
  expiresAt: number;
  name?: string;
  email?: string;
}

export interface GcalCfg {
  clientId: string;
  enabled: boolean;
  deleteOrphans: boolean;
  lastSync: string | null; // ISO datetime
}

export interface GcalLink {
  eventId: string;
  sig: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

/* ---------------- persistence ---------------- */

export function loadGcalToken(): GcalToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as GcalToken) : null;
  } catch {
    return null;
  }
}

export function saveGcalToken(t: GcalToken | null): void {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode */
  }
}

export function loadGcalCfg(): GcalCfg {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { clientId: env.googleClientId, enabled: false, deleteOrphans: true, lastSync: null, ...JSON.parse(raw) };
  } catch {
    /* fall through */
  }
  return { clientId: env.googleClientId, enabled: false, deleteOrphans: true, lastSync: null };
}

export function saveGcalCfg(c: GcalCfg): void {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(c));
  } catch {
    /* private mode */
  }
}

export function loadGcalLinks(): Record<string, GcalLink> {
  try {
    const raw = localStorage.getItem(LINKS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, GcalLink>) : {};
  } catch {
    return {};
  }
}

function saveGcalLinks(l: Record<string, GcalLink>): void {
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify(l));
  } catch {
    /* private mode */
  }
}

export function gcalConnected(): boolean {
  const t = loadGcalToken();
  return !!t && t.expiresAt > Date.now();
}

/* ---------------- Google Identity Services ---------------- */

let gisPromise: Promise<void> | null = null;

export function loadGis(): Promise<void> {
  const w = window as unknown as { google?: unknown };
  if (w.google) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error("google-script"));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

function requestToken(clientId: string, silent: boolean): Promise<TokenResponse> {
  return new Promise((resolve) => {
    const g = (window as unknown as { google: { accounts: { oauth2: { initTokenClient: (cfg: unknown) => { requestAccessToken: (o?: unknown) => void } } } } }).google;
    const tc = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp: TokenResponse) => resolve(resp),
    });
    tc.requestAccessToken(silent ? { prompt: "" } : undefined);
  });
}

export async function authorizeGoogle(clientId: string): Promise<GcalToken> {
  await loadGis();
  // try a silent refresh first (works after the very first consent)
  let resp = await requestToken(clientId, true);
  if (!resp.access_token) resp = await requestToken(clientId, false);
  if (!resp.access_token) throw new Error(resp.error || "no-token");

  const token: GcalToken = {
    accessToken: resp.access_token,
    expiresAt: Date.now() + ((resp.expires_in ?? 3600) - 60) * 1000,
  };
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (r.ok) {
      const u = (await r.json()) as { name?: string; email?: string };
      token.name = u.name;
      token.email = u.email;
    }
  } catch {
    /* identity is cosmetic */
  }
  saveGcalToken(token);
  return token;
}

/* ---------------- Calendar REST ---------------- */

async function calFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const r = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const j = (await r.json()) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch {
      /* keep status */
    }
    throw new Error(msg);
  }
  return r;
}

/* ---------------- event mapping ---------------- */

export function taskSig(task: Task, state: AppState): string {
  return JSON.stringify([
    task.title,
    task.startDate,
    task.dueDate,
    task.status,
    task.teamId,
    [...task.assigneeIds].sort(),
    task.description,
  ]);
  void state;
}

function eventBody(task: Task, state: AppState) {
  const team = state.teams.find((tm) => tm.id === task.teamId);
  const people = [...new Set([...(team?.memberIds ?? []), ...task.assigneeIds])]
    .map((id) => state.people.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  const statusLabel = task.status === "done" ? "Done" : task.status === "active" ? "In progress" : "Planned";
  const lines = [
    "Rollcall — office task",
    `Status: ${statusLabel}`,
    team ? `Team: ${team.name}` : "",
    people ? `People: ${people}` : "",
    `Period: ${fmtDateYear(task.startDate)} → ${fmtDateYear(task.dueDate)}`,
    task.description ? `Notes: ${task.description}` : "",
  ].filter(Boolean);
  return {
    summary: task.title,
    description: lines.join("\n"),
    start: { date: task.startDate },
    end: { date: addDays(task.dueDate, 1) }, // all-day end is exclusive
  };
}

/* ---------------- reconcile ---------------- */

export async function syncGcal(state: AppState): Promise<SyncResult | null> {
  const cfg = loadGcalCfg();
  const token = loadGcalToken();
  if (!token || token.expiresAt <= Date.now()) return null;

  const links = loadGcalLinks();
  const res: SyncResult = { created: 0, updated: 0, deleted: 0, unchanged: 0 };
  const next: Record<string, GcalLink> = {};

  for (const task of state.tasks) {
    const sig = taskSig(task, state);
    const link = links[task.id];
    try {
      if (link && link.sig === sig) {
        next[task.id] = link;
        res.unchanged += 1;
        continue;
      }
      if (link) {
        try {
          await calFetch(`/calendars/primary/events/${encodeURIComponent(link.eventId)}`, token.accessToken, {
            method: "PUT",
            body: JSON.stringify(eventBody(task, state)),
          });
          next[task.id] = { eventId: link.eventId, sig };
          res.updated += 1;
          continue;
        } catch (e) {
          const gone = e instanceof Error && /404|410/.test(e.message);
          if (!gone) throw e;
          /* event vanished on Google's side → recreate below */
        }
      }
      const created = await calFetch("/calendars/primary/events", token.accessToken, {
        method: "POST",
        body: JSON.stringify(eventBody(task, state)),
      });
      const j = (await created.json()) as { id: string };
      next[task.id] = { eventId: j.id, sig };
      res.created += 1;
    } catch (e) {
      if (link) next[task.id] = link; // keep the old link, retry next time
      else throw e;
    }
  }

  if (cfg.deleteOrphans) {
    for (const [taskId, link] of Object.entries(links)) {
      if (next[taskId]) continue;
      try {
        await calFetch(`/calendars/primary/events/${encodeURIComponent(link.eventId)}`, token.accessToken, {
          method: "DELETE",
        });
      } catch {
        /* already gone — fine */
      }
      res.deleted += 1;
    }
  } else {
    for (const [taskId, link] of Object.entries(links)) if (!next[taskId]) next[taskId] = link;
  }

  saveGcalLinks(next);
  cfg.lastSync = new Date().toISOString();
  saveGcalCfg(cfg);
  window.dispatchEvent(new CustomEvent("rollcall-gcal-synced"));
  return res;
}
