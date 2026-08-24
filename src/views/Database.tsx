import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppState } from "../types";
import { useStore } from "../store";
import type { BackendKind, DbConfig } from "../remotes";
import {
  BRIDGE_CMD_MYSQL,
  BRIDGE_CMD_PG,
  SUPABASE_SQL,
  configProblems,
  pullState,
  pushState,
  saveDbConfig,
  testConnection,
} from "../remotes";
import { relTime } from "../dates";
import { Field, Segmented, TextInput, btnGhost, btnPrimary, panelCls, useToast } from "../ui";
import {
  IconCalendar,
  IconCheck,
  IconCloud,
  IconCopy,
  IconDatabase,
  IconDownload,
  IconInbox,
  IconRefresh,
  IconServer,
  IconUpload,
  IconX,
} from "../icons";
import { useI18n } from "../i18n";
import { getLocale, relTime as rel } from "../dates";
import {
  authorizeGoogle,
  loadGcalCfg,
  loadGcalLinks,
  loadGcalToken,
  saveGcalCfg,
  saveGcalToken,
  syncGcal,
} from "../gcal";
import type { GcalCfg, GcalToken } from "../gcal";

function CodeBlock({ code, copyLabel, copiedLabel }: { code: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group rounded-lg border border-line2 bg-[#0a0f0c] overflow-hidden">
      <pre className="text-[11px] leading-relaxed font-mono text-mint/90 p-3 pr-16 overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(code).catch(() => {});
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-line2 bg-panel2 px-2 py-1 text-[10px] font-mono text-mut hover:text-ink hover:border-mint/40 transition-all duration-150"
      >
        {copied ? <IconCheck className="w-3 h-3 text-mint" /> : <IconCopy className="w-3 h-3" />}
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative w-10 h-[22px] rounded-full border transition-all duration-200 shrink-0 ${
        on ? "bg-mint/80 border-mint" : "bg-panel2 border-line2"
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-[2px] w-4 h-4 rounded-full bg-ink transition-all duration-200 ${
          on ? "left-[21px] bg-[#0b130e]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

const BACKENDS: { kind: BackendKind; icon: ReactNode; nameKey: string; descKey: string; tagKey: string; tagCls: string }[] = [
  {
    kind: "local",
    icon: <IconInbox className="w-4 h-4" />,
    nameKey: "db.be.local",
    descKey: "db.be.localDesc",
    tagKey: "db.tag.offline",
    tagCls: "text-mut bg-panel2 border-line2",
  },
  {
    kind: "bridge",
    icon: <IconServer className="w-4 h-4" />,
    nameKey: "db.be.bridge",
    descKey: "db.be.bridgeDesc",
    tagKey: "db.tag.noNet",
    tagCls: "text-mint bg-mint/10 border-mint/30",
  },
  {
    kind: "supabase",
    icon: <IconDatabase className="w-4 h-4" />,
    nameKey: "db.be.supabase",
    descKey: "db.be.supabaseDesc",
    tagKey: "db.tag.cloud",
    tagCls: "text-sky bg-sky/10 border-sky/30",
  },
  {
    kind: "firebase",
    icon: <IconCloud className="w-4 h-4" />,
    nameKey: "db.be.firebase",
    descKey: "db.be.firebaseDesc",
    tagKey: "db.tag.cloud",
    tagCls: "text-amber bg-amber/10 border-amber/30",
  },
];

function GooglePanel({ appState }: { appState: AppState }) {
  const { t, tp } = useI18n();
  const { push } = useToast();
  const [token, setToken] = useState<GcalToken | null>(() => loadGcalToken());
  const [gcfg, setGcfg] = useState<GcalCfg>(() => loadGcalCfg());
  const [clientId, setClientId] = useState(() => loadGcalCfg().clientId);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [linksCount, setLinksCount] = useState(() => Object.keys(loadGcalLinks()).length);

  const connected = !!token && token.expiresAt > Date.now();
  const origin = window.location.origin;

  const persistCfg = (patch: Partial<GcalCfg>) => {
    const next = { ...gcfg, ...patch };
    setGcfg(next);
    saveGcalCfg(next);
  };

  const connect = async () => {
    if (!clientId.trim()) return push(t("gcal.needId"), "warn");
    setConnecting(true);
    try {
      const tk = await authorizeGoogle(clientId.trim());
      persistCfg({ clientId: clientId.trim() });
      setToken(tk);
      push(t("gcal.connectedAs", { email: tk.email ?? tk.name ?? "Google" }));
    } catch (e) {
      push(t("gcal.error", { msg: e instanceof Error ? e.message : "?" }), "warn");
    }
    setConnecting(false);
  };

  const doSync = async () => {
    setSyncing(true);
    try {
      const res = await syncGcal(appState);
      if (!res) {
        push(t("gcal.expired"), "warn");
      } else {
        setLinksCount(Object.keys(loadGcalLinks()).length);
        const changed = res.created + res.updated + res.deleted;
        push(
          changed > 0
            ? t("gcal.syncDone", { c: res.created, u: res.updated, d: res.deleted })
            : t("gcal.syncNoop")
        );
      }
    } catch (e) {
      push(t("gcal.error", { msg: e instanceof Error ? e.message : "?" }), "warn");
    }
    setSyncing(false);
  };

  return (
    <section className={`${panelCls} reveal overflow-hidden`} style={{ animationDelay: "180ms" }}>
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 border-b border-line">
        <span className="w-9 h-9 rounded-lg bg-panel2 border border-line2 inline-flex items-center justify-center font-display font-bold text-lg text-mint shrink-0">
          G
        </span>
        <div className="flex-1 min-w-[180px]">
          <h2 className="font-display font-semibold text-lg leading-tight">{t("gcal.title")}</h2>
          <p className="text-xs text-mut mt-0.5">{t("gcal.sub")}</p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
            connected
              ? "border-mint/40 bg-mint/10 text-mint"
              : "border-line2 text-mut"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-mint pulse-dot" : "bg-line2"}`} />
          {connected ? t("gcal.connectedAs", { email: token!.email ?? token!.name ?? "Google" }) : t("gcal.notConnected")}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 p-4 sm:p-5">
        {/* left — controls */}
        <div className="space-y-4">
          {!connected && (
            <Field label={t("gcal.clientId")}>
              <TextInput
                value={clientId}
                placeholder={t("gcal.clientIdPh")}
                onChange={(e) => setClientId(e.target.value)}
              />
            </Field>
          )}

          {connected ? (
            <div className="rounded-lg border border-line bg-panel2/50 px-3.5 py-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-mut">{t("gcal.tokenUntil")}</span>
                <span className="font-mono text-[11px] text-ink">
                  {new Date(token!.expiresAt).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-mut">{t("db.last")}</span>
                <span className="font-mono text-[11px] text-ink">
                  {gcfg.lastSync ? rel(gcfg.lastSync) : t("db.never")}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-mut">{t("gcal.mirrored")}</span>
                <span className="font-mono text-[11px] text-mint">{tp("gcal.mirroredCount", linksCount)}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11.5px] text-dim leading-relaxed">{t("gcal.guideIntro")}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {connected ? (
              <>
                <button className={btnPrimary} onClick={() => void doSync()} disabled={syncing}>
                  <IconRefresh className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? t("gcal.syncing") : t("gcal.syncNow")}
                </button>
                <button
                  className={`${btnGhost} hover:text-coral hover:border-coral/40`}
                  onClick={() => {
                    saveGcalToken(null);
                    setToken(null);
                  }}
                >
                  <IconX className="w-4 h-4" /> {t("gcal.disconnect")}
                </button>
              </>
            ) : (
              <button className={btnPrimary} onClick={() => void connect()} disabled={connecting}>
                <IconCalendar className="w-4 h-4" />
                {connecting ? t("gcal.connecting") : t("gcal.connect")}
              </button>
            )}
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3">
              <Toggle on={gcfg.enabled} onChange={(v) => persistCfg({ enabled: v })} />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{t("gcal.mirror")}</span>
                <span className="block text-[11px] text-dim">{t("gcal.mirrorHint")}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Toggle on={gcfg.deleteOrphans} onChange={(v) => persistCfg({ deleteOrphans: v })} />
              <span className="text-[13px] font-medium">{t("gcal.orphans")}</span>
            </div>
          </div>
        </div>

        {/* right — setup guide */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut">{t("gcal.guide")}</p>
          <p className="text-[11px] text-dim">{t("gcal.origin")}</p>
          <CodeBlock code={origin} copyLabel={t("db.copy")} copiedLabel={t("db.copied")} />
          <ol className="space-y-1.5 text-[11.5px] leading-relaxed text-mut list-none">
            <li>{t("gcal.g1")}</li>
            <li>{t("gcal.g2")}</li>
            <li>{t("gcal.g3")}</li>
            <li>{t("gcal.g4")}</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

export function Database({
  cfg,
  onSaved,
  onPulled,
  lastSync,
  onSynced,
}: {
  cfg: DbConfig;
  onSaved: (c: DbConfig) => void;
  onPulled: (s: AppState) => void;
  lastSync: string | null;
  onSynced: (iso: string) => void;
}) {
  const { state } = useStore();
  const { t, tp } = useI18n();
  const { push } = useToast();

  const [form, setForm] = useState<DbConfig>(cfg);
  const [problems, setProblems] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullArmed, setPullArmed] = useState(false);
  const pullTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!pullArmed) return;
    pullTimer.current = window.setTimeout(() => setPullArmed(false), 2800);
    return () => {
      if (pullTimer.current) window.clearTimeout(pullTimer.current);
    };
  }, [pullArmed]);

  const set = (patch: Partial<DbConfig>) => setForm((f) => ({ ...f, ...patch }));
  const remote = form.kind !== "local";
  const records = state.people.length + state.teams.length + state.tasks.length + state.events.length;

  const save = () => {
    const p = configProblems(form);
    setProblems(p);
    if (p.length > 0) return;
    saveDbConfig(form);
    onSaved(form);
    setTestResult(null);
    push(t("db.saved"));
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await testConnection(form);
    setTestResult({ ok: r.ok, text: r.ok ? r.message : r.message });
    setTesting(false);
  };

  const doPush = async () => {
    setPushing(true);
    const r = await pushState(form, state);
    setPushing(false);
    if (r.ok) {
      if (r.updatedAt) onSynced(r.updatedAt);
      push(t("db.pushedTo", { kind: t(`db.kind.${form.kind}`), n: records }));
    } else {
      push(t("db.syncFail", { msg: r.message }), "warn");
    }
  };

  const doPull = async () => {
    setPullArmed(false);
    setPulling(true);
    const r = await pullState(form);
    setPulling(false);
    if (!r.ok) return push(t("db.syncFail", { msg: r.message }), "warn");
    if (r.empty || !r.state) return push(t("db.pullEmpty"), "warn");
    onPulled(r.state);
    if (r.updatedAt) onSynced(r.updatedAt);
    const n = r.state.people.length + r.state.teams.length + r.state.tasks.length + r.state.events.length;
    push(t("db.pulledFrom", { kind: t(`db.kind.${form.kind}`), n }));
  };

  const counts = [
    { label: t("db.cPeople"), n: state.people.length, cls: "text-mint" },
    { label: t("db.cTeams"), n: state.teams.length, cls: "text-sky" },
    { label: t("db.cTasks"), n: state.tasks.length, cls: "text-amber" },
    { label: t("db.cEvents"), n: state.events.length, cls: "text-rose" },
  ];

  return (
    <div className="space-y-4">
      <header className="reveal flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-none">{t("db.title")}</h1>
          <p className="text-mut text-sm mt-2 max-w-xl">{t("db.sub")}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line2 bg-panel2 px-3.5 py-1.5 text-xs font-medium text-mut">
          <span className={`w-2 h-2 rounded-full ${remote ? "bg-mint pulse-dot" : "bg-line2"}`} />
          {t(`db.kind.${form.kind}`)}
          {lastSync && <span className="font-mono text-[10px] text-dim">· {relTime(lastSync)}</span>}
        </span>
      </header>

      <div className="grid lg:grid-cols-[1fr_370px] gap-4 items-start">
        {/* ------------ left: backend + settings ------------ */}
        <div className="space-y-4">
          <section className={`${panelCls} reveal`} style={{ animationDelay: "60ms" }}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut px-4 sm:px-5 pt-4 pb-2">
              {t("db.where")}
            </h2>
            <div className="px-3 sm:px-4 pb-3 grid sm:grid-cols-2 gap-2">
              {BACKENDS.map((b) => {
                const on = form.kind === b.kind;
                return (
                  <button
                    key={b.kind}
                    onClick={() => {
                      set({ kind: b.kind });
                      setProblems([]);
                      setTestResult(null);
                    }}
                    className={`text-left rounded-xl border p-3.5 transition-all duration-200 ${
                      on
                        ? "border-mint/50 bg-mint/[0.06] shadow-[0_0_0_1px_rgba(111,207,151,0.25)]"
                        : "border-line bg-panel2/40 hover:border-line2 hover:bg-panel2/70"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${on ? "text-ink" : "text-mut"}`}>
                        <span className={on ? "text-mint" : "text-dim"}>{b.icon}</span>
                        {t(b.nameKey)}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-wider ${b.tagCls}`}>
                        {t(b.tagKey)}
                      </span>
                    </span>
                    <span className="block text-[11.5px] text-mut leading-relaxed mt-1.5">{t(b.descKey)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${panelCls} reveal p-4 sm:p-5`} style={{ animationDelay: "110ms" }}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut mb-3.5">
              {t("db.settings")}
            </h2>

            {form.kind === "local" && (
              <p className="text-sm text-mut leading-relaxed">{t("db.guide.local")}</p>
            )}

            {form.kind === "bridge" && (
              <div className="space-y-4">
                <Field label={t("db.engine")}>
                  <Segmented<"postgres" | "mysql">
                    value={form.bridgeEngine}
                    onChange={(v) => set({ bridgeEngine: v, dbPort: "", dbUser: v === "mysql" ? "root" : "postgres" })}
                    options={[
                      { value: "postgres", label: "PostgreSQL" },
                      { value: "mysql", label: "MySQL" },
                    ]}
                  />
                </Field>
                <Field label={t("db.bridgeUrl")}>
                  <TextInput value={form.bridgeUrl} placeholder="http://127.0.0.1:8787" onChange={(e) => set({ bridgeUrl: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("db.host")}>
                    <TextInput value={form.dbHost} onChange={(e) => set({ dbHost: e.target.value })} />
                  </Field>
                  <Field label={t("db.port")}>
                    <TextInput value={form.dbPort} placeholder={form.bridgeEngine === "mysql" ? "3306" : "5432"} onChange={(e) => set({ dbPort: e.target.value })} />
                  </Field>
                  <Field label={t("db.name")}>
                    <TextInput value={form.dbName} onChange={(e) => set({ dbName: e.target.value })} />
                  </Field>
                  <Field label={t("db.user")}>
                    <TextInput value={form.dbUser} onChange={(e) => set({ dbUser: e.target.value })} />
                  </Field>
                </div>
                <Field label={t("db.password")}>
                  <TextInput type="password" value={form.dbPassword} onChange={(e) => set({ dbPassword: e.target.value })} />
                </Field>
              </div>
            )}

            {form.kind === "supabase" && (
              <div className="space-y-4">
                <Field label={t("db.sbUrl")}>
                  <TextInput value={form.supabaseUrl} placeholder="https://abcdefgh.supabase.co" onChange={(e) => set({ supabaseUrl: e.target.value })} />
                </Field>
                <Field label={t("db.sbKey")}>
                  <TextInput type="password" value={form.supabaseKey} placeholder="eyJhbGciOi…" onChange={(e) => set({ supabaseKey: e.target.value })} />
                </Field>
              </div>
            )}

            {form.kind === "firebase" && (
              <Field label={t("db.fbUrl")}>
                <TextInput value={form.firebaseUrl} placeholder="https://my-app-default-rtdb.firebaseio.com" onChange={(e) => set({ firebaseUrl: e.target.value })} />
              </Field>
            )}

            {form.kind !== "local" && (
              <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-line">
                <div>
                  <p className="text-[13px] font-semibold">{t("db.auto")}</p>
                  <p className="text-[11px] text-mut mt-0.5">{t("db.autoHint")}</p>
                </div>
                <Toggle on={form.autoSync} onChange={(v) => set({ autoSync: v })} />
              </div>
            )}

            {problems.length > 0 && (
              <ul className="mt-4 space-y-1">
                {problems.map((p) => (
                  <li key={p} className="text-[11px] text-coral bg-coral/[0.07] border border-coral/25 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
                    <IconX className="w-3 h-3 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-end mt-4">
              <button className={btnPrimary} onClick={save}>
                <IconCheck className="w-4 h-4" /> {t("db.save")}
              </button>
            </div>
          </section>

          {/* setup guide */}
          <section className={`${panelCls} reveal p-4 sm:p-5 space-y-3`} style={{ animationDelay: "160ms" }}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut">{t("db.guide")}</h2>

            {form.kind === "bridge" && (
              <>
                <p className="text-[12.5px] text-mut leading-relaxed">{t("db.guide.introBridge")}</p>
                <p className="text-xs font-semibold text-ink">{t("db.guide.b1")}</p>
                <CodeBlock code="npm install pg mysql2" copyLabel={t("db.copy")} copiedLabel={t("db.copied")} />
                <p className="text-xs font-semibold text-ink">{t("db.guide.b2")}</p>
                <CodeBlock
                  code={form.bridgeEngine === "mysql" ? BRIDGE_CMD_MYSQL : BRIDGE_CMD_PG}
                  copyLabel={t("db.copy")}
                  copiedLabel={t("db.copied")}
                />
                <p className="text-[11.5px] text-dim leading-relaxed">{t("db.guide.b3")}</p>
              </>
            )}

            {form.kind === "supabase" && (
              <>
                <p className="text-xs font-semibold text-ink">{t("db.guide.s1")}</p>
                <CodeBlock code={SUPABASE_SQL} copyLabel={t("db.copy")} copiedLabel={t("db.copied")} />
                <p className="text-[11.5px] text-dim leading-relaxed">{t("db.guide.s2")}</p>
              </>
            )}

            {form.kind === "firebase" && (
              <>
                <p className="text-[12.5px] text-mut leading-relaxed">{t("db.guide.f1")}</p>
                <p className="text-xs font-semibold text-ink">{t("db.guide.f2")}</p>
                <CodeBlock code="https://YOUR-PROJECT-default-rtdb.firebaseio.com" copyLabel={t("db.copy")} copiedLabel={t("db.copied")} />
              </>
            )}

            {form.kind === "local" && <p className="text-[12.5px] text-mut leading-relaxed">{t("db.guide.localLong")}</p>}
          </section>
        </div>

        {/* ------------ right: sync + ledger ------------ */}
        <div className="space-y-4">
          <section className={`${panelCls} reveal p-4 sm:p-5`} style={{ animationDelay: "90ms" }}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut mb-3">{t("db.sync")}</h2>

            <div className="flex items-center justify-between text-xs text-mut mb-3.5">
              <span>{t("db.last")}</span>
              <span className="font-mono text-[11px] text-ink">{lastSync ? relTime(lastSync) : t("db.never")}</span>
            </div>

            <button
              onClick={() => void test()}
              disabled={testing}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-line2 bg-panel2 px-3.5 py-2.5 text-[13px] font-semibold hover:border-mint/40 hover:bg-raise transition-all duration-150 disabled:opacity-50"
            >
              <span className={`w-2 h-2 rounded-full ${testing ? "bg-amber animate-pulse" : testResult ? (testResult.ok ? "bg-mint" : "bg-coral") : "bg-line2"}`} />
              {testing ? t("db.testing") : t("db.test")}
            </button>

            {testResult && (
              <p
                className={`fade-in text-[11.5px] leading-relaxed mt-2.5 rounded-md px-2.5 py-2 border ${
                  testResult.ok
                    ? "text-mint bg-mint/[0.07] border-mint/25"
                    : "text-coral bg-coral/[0.07] border-coral/25"
                }`}
              >
                {testResult.text}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                className={`${btnGhost} justify-center ${!remote ? "opacity-40 pointer-events-none" : ""}`}
                onClick={() => void doPush()}
                disabled={pushing || !remote}
              >
                <IconUpload className="w-4 h-4" /> {pushing ? "…" : t("db.push")}
              </button>
              {!pullArmed ? (
                <button
                  className={`${btnGhost} justify-center ${!remote ? "opacity-40 pointer-events-none" : ""}`}
                  onClick={() => setPullArmed(true)}
                  disabled={pulling || !remote}
                >
                  <IconDownload className="w-4 h-4" /> {pulling ? "…" : t("db.pull")}
                </button>
              ) : (
                <button
                  className="fade-in inline-flex items-center justify-center gap-2 rounded-lg border border-coral/50 bg-coral/15 px-3.5 py-2 text-[13px] font-semibold text-coral hover:bg-coral/25 transition-all duration-150"
                  onClick={() => void doPull()}
                >
                  <IconX className="w-4 h-4" /> {t("db.pullArm")}
                </button>
              )}
            </div>

            {!remote && <p className="text-[11px] text-dim mt-3">{t("db.remoteOnly")}</p>}
            {remote && (
              <p className="text-[11px] text-dim mt-3">{t("db.pullWarn")}</p>
            )}
          </section>

          <section className={`${panelCls} reveal p-4 sm:p-5`} style={{ animationDelay: "140ms" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut">{t("db.counts")}</h2>
              <span className="font-mono text-[11px] text-dim">{tp("db.records", records)}</span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-line border border-line rounded-lg overflow-hidden">
              {counts.map((c) => (
                <div key={c.label} className="bg-panel2/60 px-3.5 py-3">
                  <p className={`font-display font-bold text-2xl leading-none ${c.cls}`}>{c.n}</p>
                  <p className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-mut mt-1.5">{c.label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Google Calendar mirroring */}
      <GooglePanel appState={state} />
    </div>
  );
}
