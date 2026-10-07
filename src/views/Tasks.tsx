import { useEffect, useMemo, useState } from "react";
import type { Task } from "../types";
import { involvedIds, useStore } from "../store";
import { TEAM_COLORS } from "../meta";
import { dueLabel, fmtDate, todayISO } from "../dates";
import { loadGcalLinks } from "../gcal";
import {
  Avatar,
  Chip,
  DangerAction,
  EmptyState,
  StatusSegments,
  TextInput,
  btnIcon,
  btnPrimary,
  panelCls,
  useToast,
} from "../ui";
import { IconArchive, IconListChecks, IconPlus, IconRefresh, IconSearch } from "../icons";
import { TaskModal } from "../modals";
import { useI18n } from "../i18n";

type Tab = "all" | "todo" | "active" | "done" | "late" | "archived";

const DUE_TONE_CLS: Record<string, string> = {
  late: "text-coral bg-coral/10 border-coral/30",
  today: "text-amber bg-amber/10 border-amber/30",
  soon: "text-sky bg-sky/10 border-sky/30",
  later: "text-mut bg-panel2 border-line2",
};

const RANK: Record<Task["status"], number> = { active: 0, todo: 1, done: 2 };

export function Tasks() {
  const { state, dispatch } = useStore();
  const { t, tp } = useI18n();
  const { push } = useToast();
  const today = todayISO();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ task: Task | null } | null>(null);
  const [gcalTick, setGcalTick] = useState(0);

  useEffect(() => {
    const bump = () => setGcalTick((x) => x + 1);
    window.addEventListener("rollcall-gcal-synced", bump);
    return () => window.removeEventListener("rollcall-gcal-synced", bump);
  }, []);

  const mirrored = useMemo(() => new Set(Object.keys(loadGcalLinks())), [gcalTick, state.tasks]);

  const rows = useMemo(
    () =>
      state.tasks
        .map((task) => {
          const team = state.teams.find((x) => x.id === task.teamId) ?? null;
          const members = involvedIds(state, task)
            .map((id) => state.people.find((p) => p.id === id))
            .filter((p): p is NonNullable<typeof p> => !!p);
          const overdue = task.dueDate < today && task.status !== "done";
          return { task, team, members, overdue };
        })
        .sort((a, b) => {
          // For completed tasks, sort by completion date (most recent first)
          if (a.task.status === "done" && b.task.status === "done") {
            const aCompleted = a.task.completedAt || "";
            const bCompleted = b.task.completedAt || "";
            return bCompleted.localeCompare(aCompleted); // descending
          }
          // Otherwise, sort by status rank, then due date
          return RANK[a.task.status] - RANK[b.task.status] || a.task.dueDate.localeCompare(b.task.dueDate);
        }),
    [state, today]
  );

  const live = rows.filter((r) => !r.task.archived);
  const archivedRows = rows.filter((r) => r.task.archived);

  const counts: Record<Tab, number> = {
    all: live.length,
    todo: live.filter((r) => r.task.status === "todo").length,
    active: live.filter((r) => r.task.status === "active").length,
    done: live.filter((r) => r.task.status === "done").length,
    late: live.filter((r) => r.overdue).length,
    archived: archivedRows.length,
  };

  const visible = rows
    .filter((r) => {
      if (tab === "archived") return !!r.task.archived;
      if (r.task.archived) return false;
      if (tab === "late") return r.overdue;
      if (tab === "all") return true;
      return r.task.status === tab;
    })
    .filter((r) =>
      (r.task.title + " " + r.task.description + " " + (r.team?.name ?? ""))
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    );

  const setStatus = (task: Task, status: Task["status"]) => {
    if (task.status === status) return;
    dispatch({ type: "SET_TASK_STATUS", id: task.id, status });
    if (status === "done") {
      const n = involvedIds(state, task).length;
      push(
        n > 0
          ? t("tasks.doneToast", { t: task.title, who: tp("tasks.person", n) })
          : t("mtask.updated")
      );
    } else if (status === "active") {
      push(t("tasks.activeToast", { t: task.title }));
    } else {
      push(t("tasks.queueToast", { t: task.title }));
    }
  };

  const remove = (task: Task) => {
    dispatch({ type: "REMOVE_TASK", id: task.id });
    push(t("tasks.deleted", { t: task.title }), "warn");
  };

  const archive = (task: Task) => {
    dispatch({ type: "SET_TASK_ARCHIVED", id: task.id, archived: true });
    push(t("tasks.archivedToast", { t: task.title }));
  };

  const restore = (task: Task) => {
    dispatch({ type: "SET_TASK_ARCHIVED", id: task.id, archived: false });
    push(t("tasks.restoredToast", { t: task.title }));
  };

  const TABS: { key: Tab; label: string; dot?: string }[] = [
    { key: "all", label: t("tasks.tab.all") },
    { key: "todo", label: t("tasks.tab.todo"), dot: "bg-sky" },
    { key: "active", label: t("tasks.tab.active"), dot: "bg-amber" },
    { key: "done", label: t("tasks.tab.done"), dot: "bg-mint" },
    { key: "late", label: t("tasks.tab.late"), dot: "bg-coral" },
    { key: "archived", label: t("tasks.tab.archived"), dot: "bg-sage" },
  ];

  return (
    <div className="space-y-4">
      <header className="reveal flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-none">{t("tasks.title")}</h1>
          <p className="text-mut text-sm mt-2">
            {t("tasks.summary", {
              open: counts.all - counts.done,
              late: counts.late,
              done: counts.done,
            })}
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setModal({ task: null })}>
          <IconPlus className="w-4 h-4" /> {t("tasks.new")}
        </button>
      </header>

      <div className="reveal flex flex-wrap items-center gap-2.5" style={{ animationDelay: "70ms" }}>
        <div className="relative w-full sm:w-64">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <TextInput
            className="pl-9"
            placeholder={t("tasks.searchPh")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((f) => {
            const on = tab === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setTab(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  on ? "bg-panel2 border-line2 text-ink" : "border-line text-mut hover:text-ink hover:border-line2"
                }`}
              >
                {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot} ${counts[f.key] === 0 ? "opacity-30" : ""}`} />}
                {f.label}
                <span className="font-mono text-[10px] text-dim">{counts[f.key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {state.tasks.length === 0 ? (
        <div className={panelCls}>
          <EmptyState
            icon={<IconListChecks className="w-5 h-5" />}
            title={t("tasks.emptyTitle")}
            body={t("tasks.emptyBody")}
            action={
              <button className={btnPrimary} onClick={() => setModal({ task: null })}>
                <IconPlus className="w-4 h-4" /> {t("tasks.emptyAction")}
              </button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className={panelCls}>
          <EmptyState
            icon={<IconSearch className="w-5 h-5" />}
            title={t("tasks.noMatchTitle")}
            body={t("tasks.noMatchBody")}
          />
        </div>
      ) : (
        <div className={`${panelCls} overflow-hidden`}>
          {visible.map((r, i) => {
            const due = dueLabel(r.task.dueDate);
            const done = r.task.status === "done";
            const isArchived = !!r.task.archived;
            return (
              <div
                key={r.task.id}
                onClick={() => setModal({ task: r.task })}
                className={`reveal group flex flex-wrap sm:flex-nowrap items-center gap-3 px-3.5 sm:px-4 py-3.5 hover:bg-panel2/60 cursor-pointer transition-colors border-b border-line last:border-b-0 ${
                  isArchived ? "opacity-60 hover:opacity-90" : ""
                }`}
                style={{ animationDelay: `${Math.min(i * 45, 400)}ms` }}
              >
                {!isArchived && (
                  <StatusSegments value={r.task.status} onChange={(s) => setStatus(r.task, s)} />
                )}
                <div className="flex-1 min-w-[200px]">
                  <p className={`text-sm font-semibold leading-tight ${done || isArchived ? "line-through decoration-line2 text-mut" : ""}`}>
                    {r.task.title}
                    {isArchived && (
                      <span className="ml-2 align-middle inline-block rounded border border-sage/40 bg-sage/10 px-1.5 py-px font-mono text-[9.5px] font-normal tracking-wide text-sage">
                        {t("tasks.archivedChip")}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-mut truncate mt-0.5">
                    <span className="font-mono text-dim">
                      {fmtDate(r.task.startDate)} → {fmtDate(r.task.dueDate)}
                    </span>
                    {r.task.description && <> · {r.task.description}</>}
                  </p>
                </div>
                <div className="hidden md:block shrink-0">
                  {r.team ? (
                    <Chip className={TEAM_COLORS[r.team.color].chip}>
                      <span className={`w-1.5 h-1.5 rounded-full ${TEAM_COLORS[r.team.color].dot}`} />
                      {r.team.name}
                    </Chip>
                  ) : (
                    <span className="text-xs text-dim">{t("tasks.noTeam")}</span>
                  )}
                </div>
                {mirrored.has(r.task.id) && (
                  <span
                    title={t("gcal.mirrored")}
                    className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md bg-sky/10 border border-sky/30 text-sky font-display font-bold text-[11px] select-none"
                  >
                    G
                  </span>
                )}
                <div className="flex -space-x-1.5 shrink-0">
                  {r.members.slice(0, 4).map((m) => (
                    <Avatar key={m.id} name={m.name} hue={m.hue} size={24} className="ring-2 ring-panel" />
                  ))}
                  {r.members.length > 4 && (
                    <span className="w-6 h-6 rounded-full bg-panel2 border border-line2 inline-flex items-center justify-center text-[10px] font-mono text-mut ring-2 ring-panel">
                      +{r.members.length - 4}
                    </span>
                  )}
                </div>
                <Chip
                  className={`w-[116px] justify-center shrink-0 ${
                    isArchived
                      ? "text-sage bg-sage/10 border-sage/30"
                      : done
                      ? "text-mint bg-mint/10 border-mint/30"
                      : DUE_TONE_CLS[due.tone]
                  }`}
                >
                  {isArchived
                    ? t("tasks.tab.archived")
                    : done
                    ? t("tasks.doneOn", { d: r.task.completedAt ? fmtDate(r.task.completedAt) : "" })
                    : due.text}
                </Chip>
                {isArchived ? (
                  <button
                    className={`${btnIcon} hover:text-mint`}
                    title={t("tasks.restore")}
                    onClick={(e) => {
                      e.stopPropagation();
                      restore(r.task);
                    }}
                  >
                    <IconRefresh className="w-4 h-4" />
                  </button>
                ) : (
                  done && (
                    <button
                      className={`${btnIcon} hover:text-sage`}
                      title={t("tasks.archive")}
                      onClick={(e) => {
                        e.stopPropagation();
                        archive(r.task);
                      }}
                    >
                      <IconArchive className="w-4 h-4" />
                    </button>
                  )
                )}
                <DangerAction onConfirm={() => remove(r.task)} label={t("tasks.deleted", { t: r.task.title })} />
              </div>
            );
          })}
        </div>
      )}

      <TaskModal open={modal !== null} task={modal?.task ?? null} onClose={() => setModal(null)} />
    </div>
  );
}
