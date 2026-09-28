import { useMemo, useState } from "react";
import { useStore } from "../store";
import { fmtDate, relTime } from "../dates";
import { Avatar, Chip, EmptyState, panelCls } from "../ui";
import { IconActivity, IconArchive, IconCheck, IconFlag, IconListChecks, IconPencil, IconPlus, IconTrash, IconUsers } from "../icons";
import { useI18n } from "../i18n";

type EntityType = "person" | "team" | "task" | "event";

const ENTITY_ICONS: Record<EntityType, React.ReactNode> = {
  person: <IconUsers className="w-4 h-4" />,
  team: <IconFlag className="w-4 h-4" />,
  task: <IconListChecks className="w-4 h-4" />,
  event: <IconActivity className="w-4 h-4" />,
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <IconPlus className="w-3.5 h-3.5" />,
  update: <IconPencil className="w-3.5 h-3.5" />,
  delete: <IconTrash className="w-3.5 h-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  create: "text-mint bg-mint/10 border-mint/30",
  update: "text-amber bg-amber/10 border-amber/30",
  delete: "text-coral bg-coral/10 border-coral/30",
};

export function Audit() {
  const { state } = useStore();
  const { t } = useI18n();
  const [filter, setFilter] = useState<EntityType | "all">("all");

  const filtered = useMemo(() => {
    const entries = filter === "all" 
      ? state.auditLog 
      : state.auditLog.filter((e) => e.entityType === filter);
    // Sort by timestamp descending (most recent first)
    return [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.auditLog, filter]);

  const counts = useMemo(() => {
    const c = { all: state.auditLog.length, person: 0, team: 0, task: 0, event: 0 };
    state.auditLog.forEach((e) => {
      c[e.entityType] += 1;
    });
    return c;
  }, [state.auditLog]);

  return (
    <div className="space-y-4">
      <header className="reveal flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-none">
            {t("nav.audit")}
          </h1>
          <p className="text-mut text-sm mt-2">
            {state.auditLog.length} {state.auditLog.length === 1 ? "entry" : "entries"} logged
          </p>
        </div>
      </header>

      {/* Filter bar */}
      <div className="reveal flex flex-wrap gap-1.5" style={{ animationDelay: "70ms" }}>
        {(["all", "person", "team", "task", "event"] as const).map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                on ? "bg-panel2 border-line2 text-ink" : "border-line text-mut hover:text-ink hover:border-line2"
              }`}
            >
              {f !== "all" && ENTITY_ICONS[f]}
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="font-mono text-[10px] text-dim">{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {/* Audit log */}
      {state.auditLog.length === 0 ? (
        <div className={panelCls}>
          <EmptyState
            icon={<IconArchive className="w-5 h-5" />}
            title="No activity yet"
            body="The audit log will show all changes made to people, teams, tasks, and events."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className={panelCls}>
          <EmptyState
            icon={<IconArchive className="w-5 h-5" />}
            title="No entries match this filter"
            body="Try selecting a different category."
          />
        </div>
      ) : (
        <div className={`${panelCls} divide-y divide-line overflow-hidden`}>
          {filtered.map((entry, i) => (
            <div
              key={entry.id}
              className="reveal flex items-start gap-3 px-4 py-3 hover:bg-panel2/60 transition-colors"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
            >
              {/* Icon */}
              <span className="mt-0.5 text-dim shrink-0">{ENTITY_ICONS[entry.entityType]}</span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{entry.entityName}</span>
                  <Chip className={ACTION_COLORS[entry.action]}>
                    {ACTION_ICONS[entry.action]}
                    {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
                  </Chip>
                  <span className="text-xs text-mut capitalize">{entry.entityType}</span>
                </div>
                {entry.details && (
                  <p className="text-xs text-mut mt-1 leading-relaxed">{entry.details}</p>
                )}
                <p className="text-[10.5px] font-mono text-dim mt-1.5">
                  {fmtDate(entry.timestamp.slice(0, 10))} · {relTime(entry.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
