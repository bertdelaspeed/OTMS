import { useEffect, useState } from "react";
import type { FC, SVGProps } from "react";
import type { ViewKey } from "./types";
import { StoreProvider, useStore } from "./store";
import { ToastProvider, useToast } from "./ui";
import { seedState } from "./data";
import { fmtDateFull, todayISO } from "./dates";
import { Dashboard } from "./views/Dashboard";
import { People } from "./views/People";
import { Profile } from "./views/Profile";
import { Teams } from "./views/Teams";
import { Tasks } from "./views/Tasks";
import { IconCalendar, IconFlag, IconGauge, IconListChecks, IconLogo, IconRefresh, IconUsers } from "./icons";

const NAV: { key: ViewKey; label: string; Icon: FC<SVGProps<SVGSVGElement>> }[] = [
  { key: "dashboard", label: "Today", Icon: IconGauge },
  { key: "people", label: "People", Icon: IconUsers },
  { key: "teams", label: "Teams", Icon: IconFlag },
  { key: "tasks", label: "Tasks", Icon: IconListChecks },
];

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}

function Shell() {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const [view, setView] = useState<ViewKey>("dashboard");
  const [personId, setPersonId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const i = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(i);
  }, []);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 2600);
    return () => window.clearTimeout(t);
  }, [armed]);

  const openTasks = state.tasks.filter((t) => t.status !== "done").length;
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
  };

  const crumb = personId
    ? "Person record"
    : view === "dashboard"
    ? "Morning rollcall"
    : NAV.find((n) => n.key === view)!.label;

  const doReset = () => {
    dispatch({ type: "RESET", state: seedState() });
    setArmed(false);
    push("Demo data restored to a fresh state");
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
            <p className="font-display font-bold text-[17px] leading-none tracking-tight">Rollcall</p>
            <p className="font-mono text-[9.5px] text-dim mt-1 uppercase tracking-[0.22em]">Office ledger</p>
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
                <span className="hidden md:inline flex-1 text-left font-medium">{n.label}</span>
                {counts[n.key] !== null && (
                  <span className="hidden md:inline font-mono text-[10px] text-dim">{counts[n.key]}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-line p-2 md:p-3 space-y-2 shrink-0">
          <button
            onClick={() => (armed ? doReset() : setArmed(true))}
            className={`w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all duration-150 ${
              armed
                ? "border-coral/50 bg-coral/10 text-coral"
                : "border-line2 text-dim hover:text-mut hover:bg-panel2"
            }`}
          >
            <IconRefresh className="w-3.5 h-3.5 shrink-0 mx-auto md:mx-0" />
            <span className="hidden md:inline">{armed ? "Confirm reset?" : "Reset demo data"}</span>
          </button>
          <p className="hidden md:flex items-center gap-2 px-1.5 font-mono text-[9.5px] text-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-mint pulse-dot shrink-0" />
            Saved locally · {records} records
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        <header className="sticky top-0 z-20 h-14 shrink-0 border-b border-line bg-bg/85 backdrop-blur-sm flex items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-dim hidden sm:inline">
              Office ledger
            </span>
            <span className="text-dim hidden sm:inline">/</span>
            <span className="text-sm font-semibold truncate">{crumb}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-2 font-mono text-[11px] text-mut border border-line2 rounded-full px-3 py-1">
              <IconCalendar className="w-3.5 h-3.5 text-dim" />
              {fmtDateFull(todayISO())}
            </span>
            <span className="font-mono text-sm font-semibold text-mint tabular-nums">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
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
            ) : (
              <Tasks />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
