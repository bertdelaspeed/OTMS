import type { AppState } from "./types";
import { env } from "./env";

export type BackendKind = "local" | "bridge" | "supabase" | "firebase";
export type BridgeEngine = "postgres" | "mysql";

export interface DbConfig {
  kind: BackendKind;
  bridgeUrl: string;
  bridgeEngine: BridgeEngine;
  dbHost: string;
  dbPort: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  supabaseUrl: string;
  supabaseKey: string;
  firebaseUrl: string;
  autoSync: boolean;
}

const KEY = "rollcall.db.v1";
const LAST = "rollcall.dbsync.last";

export function defaultDbConfig(): DbConfig {
  return {
    kind: env.dbKind,
    bridgeUrl: "http://127.0.0.1:8787",
    bridgeEngine: "postgres",
    dbHost: "127.0.0.1",
    dbPort: "",
    dbName: "rollcall",
    dbUser: "postgres",
    dbPassword: "",
    supabaseUrl: env.supabaseUrl,
    supabaseKey: env.supabaseAnonKey,
    firebaseUrl: env.firebaseUrl,
    autoSync: env.autoSync,
  };
}

export function loadDbConfig(): DbConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultDbConfig(), ...(JSON.parse(raw) as Partial<DbConfig>) };
  } catch {
    /* ignore */
  }
  return defaultDbConfig();
}

export function saveDbConfig(cfg: DbConfig): void {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function loadLastSync(): string | null {
  return localStorage.getItem(LAST);
}

export function saveLastSync(iso: string): void {
  localStorage.setItem(LAST, iso);
}

export interface RemoteReply {
  ok: boolean;
  message: string;
  empty?: boolean;
  state?: AppState;
  updatedAt?: string;
  ms?: number;
}

function isValidState(s: unknown): s is AppState {
  const x = s as AppState;
  return (
    !!x &&
    Array.isArray(x.people) &&
    Array.isArray(x.teams) &&
    Array.isArray(x.tasks) &&
    Array.isArray(x.events)
  );
}

function netError(e: unknown, target: string): RemoteReply {
  const msg = e instanceof Error ? e.message : String(e);
  return { ok: false, message: `${target} — ${msg}` };
}

/* ---------------- bridge (local Postgres / MySQL) ---------------- */

function bridgeBase(cfg: DbConfig): string {
  return cfg.bridgeUrl.trim().replace(/\/+$/, "") || "http://127.0.0.1:8787";
}

function bridgeParams(cfg: DbConfig): string {
  const q = new URLSearchParams({
    engine: cfg.bridgeEngine,
    host: cfg.dbHost.trim() || "127.0.0.1",
    db: cfg.dbName.trim() || "rollcall",
    user: cfg.dbUser.trim(),
  });
  if (cfg.dbPort.trim()) q.set("port", cfg.dbPort.trim());
  if (cfg.dbPassword) q.set("password", cfg.dbPassword);
  return q.toString();
}

async function bridgeHealth(cfg: DbConfig): Promise<RemoteReply> {
  const started = performance.now();
  try {
    const res = await fetch(`${bridgeBase(cfg)}/api/health?${bridgeParams(cfg)}`);
    const j = (await res.json()) as { ok: boolean; engine?: string; message?: string };
    const ms = Math.round(performance.now() - started);
    if (j.ok) return { ok: true, ms, message: `${j.engine} answered in ${ms} ms` };
    return { ok: false, ms, message: j.message ?? "bridge refused the connection" };
  } catch (e) {
    return netError(e, "Cannot reach the bridge — is it running?");
  }
}

async function bridgePull(cfg: DbConfig): Promise<RemoteReply> {
  try {
    const res = await fetch(`${bridgeBase(cfg)}/api/state?${bridgeParams(cfg)}`);
    const j = (await res.json()) as { ok: boolean; empty?: boolean; state?: AppState; message?: string; updatedAt?: string };
    if (!j.ok) return { ok: false, message: j.message ?? "bridge error" };
    if (j.empty || !j.state) return { ok: true, empty: true, message: "The database is empty — nothing to pull yet." };
    if (!isValidState(j.state)) return { ok: false, message: "The bridge returned an unexpected shape." };
    return { ok: true, state: j.state, updatedAt: j.updatedAt, message: "pulled" };
  } catch (e) {
    return netError(e, "Cannot reach the bridge");
  }
}

async function bridgePush(cfg: DbConfig, state: AppState): Promise<RemoteReply> {
  try {
    const res = await fetch(`${bridgeBase(cfg)}/api/state?${bridgeParams(cfg)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    const j = (await res.json()) as { ok: boolean; message?: string; updatedAt?: string };
    if (!j.ok) return { ok: false, message: j.message ?? "bridge error" };
    return { ok: true, updatedAt: j.updatedAt, message: "pushed" };
  } catch (e) {
    return netError(e, "Cannot reach the bridge");
  }
}

/* ---------------- supabase (PostgREST, no SDK) ---------------- */

function sbHeaders(cfg: DbConfig, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: cfg.supabaseKey.trim(),
    Authorization: `Bearer ${cfg.supabaseKey.trim()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function sbBase(cfg: DbConfig): string {
  return cfg.supabaseUrl.trim().replace(/\/+$/, "");
}

async function supabasePull(cfg: DbConfig): Promise<RemoteReply> {
  try {
    const res = await fetch(`${sbBase(cfg)}/rest/v1/rollcall_state?select=data,updated_at&id=eq.1`, {
      headers: sbHeaders(cfg),
    });
    if (!res.ok) {
      const body = await res.text();
      const hint =
        res.status === 404 || body.includes("PGRST116") || body.includes("schema cache")
          ? " The table rollcall_state does not exist yet — run the SQL from the setup guide."
          : "";
      return { ok: false, message: `Supabase ${res.status}: ${body.slice(0, 140)}.${hint}` };
    }
    const rows = (await res.json()) as { data: AppState; updated_at: string }[];
    if (!rows.length || !rows[0].data)
      return { ok: true, empty: true, message: "The Supabase table is empty — nothing to pull yet." };
    if (!isValidState(rows[0].data)) return { ok: false, message: "Unexpected data shape in Supabase." };
    return { ok: true, state: rows[0].data, updatedAt: rows[0].updated_at, message: "pulled" };
  } catch (e) {
    return netError(e, "Cannot reach Supabase");
  }
}

async function supabasePush(cfg: DbConfig, state: AppState): Promise<RemoteReply> {
  try {
    const res = await fetch(`${sbBase(cfg)}/rest/v1/rollcall_state`, {
      method: "POST",
      headers: sbHeaders(cfg, { Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        id: 1,
        data: state,
        version: Date.now(),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      const hint =
        res.status === 404 || body.includes("PGRST116")
          ? " The table rollcall_state does not exist yet — run the SQL from the setup guide."
          : res.status === 401 || res.status === 403
          ? " Check the anon key and RLS policies."
          : "";
      return { ok: false, message: `Supabase ${res.status}: ${body.slice(0, 140)}.${hint}` };
    }
    return { ok: true, updatedAt: new Date().toISOString(), message: "pushed" };
  } catch (e) {
    return netError(e, "Cannot reach Supabase");
  }
}

/* ---------------- firebase realtime db (REST, no SDK) ---------------- */

function fbBase(cfg: DbConfig): string {
  return cfg.firebaseUrl.trim().replace(/\/+$/, "");
}

async function firebasePull(cfg: DbConfig): Promise<RemoteReply> {
  try {
    const res = await fetch(`${fbBase(cfg)}/rollcall.json`);
    if (!res.ok) return { ok: false, message: `Firebase ${res.status}: ${await res.text()}` };
    const j = (await res.json()) as { data?: AppState; updated_at?: string } | null;
    if (!j || !j.data) return { ok: true, empty: true, message: "The Firebase path is empty — nothing to pull yet." };
    if (!isValidState(j.data)) return { ok: false, message: "Unexpected data shape in Firebase." };
    return { ok: true, state: j.data, updatedAt: j.updated_at, message: "pulled" };
  } catch (e) {
    return netError(e, "Cannot reach Firebase");
  }
}

async function firebasePush(cfg: DbConfig, state: AppState): Promise<RemoteReply> {
  try {
    const res = await fetch(`${fbBase(cfg)}/rollcall.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: state, version: Date.now(), updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return { ok: false, message: `Firebase ${res.status}: ${await res.text()}` };
    return { ok: true, updatedAt: new Date().toISOString(), message: "pushed" };
  } catch (e) {
    return netError(e, "Cannot reach Firebase");
  }
}

/* ---------------- facade ---------------- */

export function configProblems(cfg: DbConfig): string[] {
  const problems: string[] = [];
  if (cfg.kind === "bridge" && !/^https?:\/\//.test(cfg.bridgeUrl.trim()))
    problems.push("Bridge address must start with http:// or https://");
  if (cfg.kind === "supabase") {
    if (!/^https:\/\/.+\.supabase\.co$/i.test(cfg.supabaseUrl.trim()))
      problems.push("Project URL looks wrong — it ends with .supabase.co");
    if (!cfg.supabaseKey.trim()) problems.push("The anon key is required");
  }
  if (cfg.kind === "firebase" && !/^https:\/\/.+firebaseio\.(com|app)$/i.test(cfg.firebaseUrl.trim()))
    problems.push("Database URL looks wrong — it ends with firebaseio.com");
  return problems;
}

export async function testConnection(cfg: DbConfig): Promise<RemoteReply> {
  if (cfg.kind === "local") return { ok: true, ms: 0, message: "Browser storage is always available." };
  if (cfg.kind === "bridge") return bridgeHealth(cfg);
  if (cfg.kind === "supabase") {
    const started = performance.now();
    try {
      const res = await fetch(`${sbBase(cfg)}/rest/v1/rollcall_state?select=id&id=eq.1&limit=1`, {
        headers: sbHeaders(cfg),
      });
      const ms = Math.round(performance.now() - started);
      if (res.status === 401 || res.status === 403)
        return { ok: false, ms, message: `Supabase refused the key (HTTP ${res.status}).` };
      if (res.status === 404)
        return {
          ok: false,
          ms,
          message: "Project reached, but the rollcall_state table is missing — run the SQL from the setup guide.",
        };
      if (res.ok) return { ok: true, ms, message: `Supabase answered in ${ms} ms` };
      return { ok: false, ms, message: `Supabase HTTP ${res.status}` };
    } catch (e) {
      return netError(e, "Cannot reach Supabase");
    }
  }
  const started = performance.now();
  try {
    const res = await fetch(`${fbBase(cfg)}/rollcall.json`);
    const ms = Math.round(performance.now() - started);
    if (!res.ok) return { ok: false, ms, message: `Firebase HTTP ${res.status} — check the URL and the rules.` };
    return { ok: true, ms, message: `Firebase answered in ${ms} ms` };
  } catch (e) {
    return netError(e, "Cannot reach Firebase");
  }
}

export function pullState(cfg: DbConfig): Promise<RemoteReply> {
  if (cfg.kind === "bridge") return bridgePull(cfg);
  if (cfg.kind === "supabase") return supabasePull(cfg);
  if (cfg.kind === "firebase") return firebasePull(cfg);
  return Promise.resolve({ ok: false, message: "Pull is only available with a remote backend." });
}

export function pushState(cfg: DbConfig, state: AppState): Promise<RemoteReply> {
  if (cfg.kind === "bridge") return bridgePush(cfg, state);
  if (cfg.kind === "supabase") return supabasePush(cfg, state);
  if (cfg.kind === "firebase") return firebasePush(cfg, state);
  return Promise.resolve({ ok: false, message: "Push is only available with a remote backend." });
}

export const SUPABASE_SQL = `create table if not exists rollcall_state (
  id int primary key,
  data jsonb not null,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table rollcall_state enable row level security;

create policy "rollcall anon read"  on rollcall_state for select using (true);
create policy "rollcall anon write" on rollcall_state for insert with check (true);
create policy "rollcall anon update" on rollcall_state for update using (true);`;

export const BRIDGE_CMD_PG = `node server/bridge.mjs --engine postgres \\
  --db rollcall --user postgres --password YOUR_PASSWORD`;

export const BRIDGE_CMD_MYSQL = `node server/bridge.mjs --engine mysql \\
  --db rollcall --user root --password YOUR_PASSWORD`;
