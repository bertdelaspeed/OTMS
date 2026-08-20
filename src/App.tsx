import { useEffect, useRef, useState } from "react";
import type { FC, SVGProps } from "react";
import type { AppState, ViewKey } from "./types";
import { StoreProvider, useStore } from "./store";
import { ToastProvider, btnIcon, useToast } from "./ui";
import { I18nProvider, useI18n } from "./i18n";
import type { Lang } from "./i18n";
import { seedState } from "./data";
import { fmtDateFull, getLocale, relTime, todayISO } from "./dates";
import type { DbConfig } from "./remotes";
import { loadDbConfig, loadLastSync, pushState, saveLastSync } from "./remotes";
import { Dashboard } from "./views/Dashboard";
import { People } from "./views/People";
import { Profile } from "./views/Profile";
import { Teams } from "./views/Teams";
import { Tasks } from "./views/Tasks";
import { CalendarView } from "./views/CalendarView";
import { Activity } from "./views/Activity";
import { Database } from "./views/Database";
import {
  IconActivity,
  IconCalendar,
  IconDatabase,
  IconDownload,
  IconFlag,
  IconGauge,
  IconGlobe,
  IconListChecks,
  IconLogo,
  IconRefresh,
  IconUpload,
  IconUsers,
} from "./icons";

const NAV: { key: ViewKey; labelKey: string; Icon: FC<SVGProps<SVGSVGElement>> }[] = [
  { key: "dashboard", labelKey: "nav.today", Icon: IconGauge },
  { key: "people", labelKey: "nav.people", Icon: IconUsers },
  { key: "teams", labelKey: "nav.teams", Icon: IconFlag },
  { key: "tasks", labelKey: "nav.tasks", Icon: IconListChecks },
  { key: "calendar", labelKey: "nav.calendar", Icon: IconCalendar },
  { key: "activity", labelKey: "nav.activity", Icon: IconActivity },
  { key: "database", labelKey: "nav.database", Icon: IconDatabase },
];

export default function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </StoreProvider>
    </I18nProvider>
  );
}

function LangSwitch() {
  const { lang, setLang } = useI18n();
  const { t } = useI18n();
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-line2 bg-panel2 p-0.5"
      role="group"
      aria-label={t("lang.label")}
    >
      <IconGlobe className="w-3.5 h-3.5 text-dim ml-1.5" />
      {(["en", "fr"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide transition-all duration-150 ${
            lang === l ? "bg-mint text-[#0b130e]" : "text-mut hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Shell() {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const { push } = useToast();
  const [view, setView] = useState<ViewKey>("dashboard");
  const [personId, setPersonId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [armed, setArmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dbCfg, setDbCfg] = useState<DbConfig>(loadDbConfig);
  const [lastSync, setLastSync] = useState<string | null>(loadLastSync);
  const skipPush = useRef(true);
  const failNotified = useRef(false);

  useEffect(() => {
    const i = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(i);
  }, []);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 2600);
    return () => window.clearTimeout(timer);
  }, [armed]);

  /* auto-push every change to the configured remote backend */
  useEffect(() => {
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }
    if (dbCfg.kind === "local" || !dbCfg.autoSync) return;
    const timer = window.setTimeout(() => {
      void pushState(dbCfg, state).then((r) => {
        if (r.ok && r.updatedAt) {
          saveLastSync(r.updatedAt);
          setLastSync(r.updatedAt);
          failNotified.current = false;
        } else if (!r.ok && !failNotified.current) {
          failNotified.current = true;
          push(t("db.syncFail", { msg: r.message }), "warn");
        }
      });
    }, 1600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, dbCfg]);

  const openTasks = state.tasks.filter((x) => x.status !== "done").length;
  const records = state.people.length + state.teams.length + state.tasks.length + state.events.length;

  const navigate = (v: ViewKey) => {
    setView(v);
    setPersonId(null);
  };

  const counts: Record<ViewKey, number | null> = {
    dashboard: null,
    people: state.people.length,
    teams: state.teams.length,
    tasks: openTasks,
    calendar: null,
    activity: null,
    database: null,
  };

  const crumb = personId
    ? t("crumb.record")
    : view === "dashboard"
    ? t("crumb.rollcall")
    : t(NAV.find((n) => n.key === view)!.labelKey);

  const doReset = () => {
    dispatch({ type: "RESET", state: seedState() });
    setArmed(false);
    push(t("data.resetDone"));
  };

  const doExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rollcall-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    push(t("data.exported"));
  };

  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState;
        if (
          !parsed ||
          !Array.isArray(parsed.people) ||
          !Array.isArray(parsed.teams) ||
          !Array.isArray(parsed.tasks) ||
          !Array.isArray(parsed.events)
        ) {
          throw new Error("invalid");
        }
        dispatch({ type: "RESET", state: parsed });
        const n =
          parsed.people.length + parsed.teams.length + parsed.tasks.length + parsed.events.length;
        push(t("data.imported", { n }));
      } catch {
        push(t("data.importError"), "warn");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute -top-32 -left-32 w-[540px] h-[540px] rounded-full bg-mint/[0.05] blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] rounded-full bg-amber/[0.045] blur-3xl" />
      </div>

      {/* Sidebar */}
      <aside className="sticky top-0 h-screen w-14 md:w-56 shrink-0 border-r border-line bg-panel/75 backdrop-blur-sm z-30 flex flex-col">
        <div className="flex items-center gap-2.5 px-[13px] md:px-5 h-16 border-b border-line shrink-0">
          <span className="w-8 h-8 rounded-lg bg-mint/10 border border-mint/40 text-mint inline-flex items-center justify-center shrink-0">
            <IconLogo className="w-[18px] h-[18px]" />
          </span>
          <div className="hidden md:block min-w-0">
            <p className="font-display font-bold text-[17px] leading-none tracking-tight">{t("app.name")}</p>
            <p className="font-mono text-[9.5px] text-dim mt-1 uppercase tracking-[0.22em]">
              {t("app.tagline")}
            </p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 md:px-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => {
            const active = !personId && view === n.key;
            return (
              <button
                key={n.key}
                onClick={() => navigate(n.key)}
                className={`relative flex items-center gap-3 w-full rounded-lg px-2.5 md:px-3 py-2.5 text-sm transition-all duration-150 ${
                  active ? "bg-panel2 text-ink" : "text-mut hover:text-ink hover:bg-panel2/60"
                }`}
              >
                {active && (
                  <span className="absolute left-[-8px] md:left-[-12px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-mint" />
                )}
                <n.Icon className={`w-[18px] h-[18px] shrink-0 mx-auto md:mx-0 ${active ? "text-mint" : ""}`} />
                <span className="hidden md:inline flex-1 text-left font-medium">{t(n.labelKey)}</span>
                {counts[n.key] !== null && (
                  <span className="hidden md:inline font-mono text-[10px] text-dim">{counts[n.key]}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-line p-2 md:p-3 space-y-1.5 shrink-0">
          <p className="hidden md:block px-1.5 pb-0.5 text-[9.5px] font-mono uppercase tracking-[0.2em] text-dim">
            {t("data.title")}
          </p>
          <div className="grid grid-cols-3 md:grid-cols-2 gap-1.5">
            <button
              className={`${btnIcon} w-full h-8`}
              title={t("data.export")}
              aria-label={t("data.export")}
              onClick={doExport}
            >
              <IconDownload className="w-4 h-4" />
            </button>
            <button
              className={`${btnIcon} w-full h-8`}
              title={t("data.import")}
              aria-label={t("data.import")}
              onClick={() => fileRef.current?.click()}
            >
              <IconUpload className="w-4 h-4" />
            </button>
            <button
              onClick={() => (armed ? doReset() : setArmed(true))}
              title={t("data.reset")}
              className={`col-span-1 md:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border h-8 px-2 text-[11px] font-semibold transition-all duration-150 ${
                armed
                  ? "border-coral/50 bg-coral/10 text-coral"
                  : "border-line2 text-mut hover:text-ink hover:bg-panel2"
              }`}
            >
              <IconRefresh className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline truncate">
                {armed ? t("data.resetConfirm") : t("data.reset")}
              </span>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => navigate("database")}
            className="hidden md:flex w-full items-center gap-2 px-1.5 pt-1 font-mono text-[9.5px] text-dim hover:text-mut transition-colors text-left"
            title={t("nav.database")}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                dbCfg.kind === "local" ? "bg-line2" : "bg-mint pulse-dot"
              }`}
            />
            <span className="truncate">
              {t(`db.kind.${dbCfg.kind}`)}
              {lastSync ? ` · ${t("db.sidebarSynced", { t: relTime(lastSync) })}` : ""}
            </span>
          </button>
          <p className="hidden md:flex items-center gap-2 px-1.5 pt-1 font-mono text-[9.5px] text-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-mint pulse-dot shrink-0" />
            {t("data.saved", { n: records })}
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        <header className="sticky top-0 z-20 h-14 shrink-0 border-b border-line bg-bg/85 backdrop-blur-sm flex items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-dim hidden sm:inline">
              {t("app.tagline")}
            </span>
            <span className="text-dim hidden sm:inline">/</span>
            <span className="text-sm font-semibold truncate">{crumb}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden lg:inline-flex items-center gap-2 font-mono text-[11px] text-mut border border-line2 rounded-full px-3 py-1">
              <IconCalendar className="w-3.5 h-3.5 text-dim" />
              {fmtDateFull(todayISO())}
            </span>
            <span className="hidden sm:inline font-mono text-sm font-semibold text-mint tabular-nums">
              {now.toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })}
            </span>
            <LangSwitch />
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 sm:px-6 py-6">
          <div key={personId ?? view} className="fade-in">
            {personId ? (
              <Profile personId={personId} onBack={() => setPersonId(null)} onDeleted={() => setPersonId(null)} />
            ) : view === "dashboard" ? (
              <Dashboard onOpenPerson={setPersonId} onNavigate={navigate} />
            ) : view === "people" ? (
              <People onOpenPerson={setPersonId} />
            ) : view === "teams" ? (
              <Teams />
            ) : view === "calendar" ? (
              <CalendarView onOpenPerson={setPersonId} onNavigate={navigate} />
            ) : view === "activity" ? (
              <Activity onOpenPerson={setPersonId} />
            ) : view === "database" ? (
              <Database
                cfg={dbCfg}
                onSaved={setDbCfg}
                onPulled={(s) => {
                  skipPush.current = true;
                  dispatch({ type: "RESET", state: s });
                }}
                lastSync={lastSync}
                onSynced={(iso) => {
                  saveLastSync(iso);
                  setLastSync(iso);
                }}
              />
            ) : (
              <Tasks />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
