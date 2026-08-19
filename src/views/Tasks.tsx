import { useMemo, useState } from "react";
import type { Task } from "../types";
import { involvedIds, useStore } from "../store";
import { TEAM_COLORS } from "../meta";
import { dueLabel, fmtDate, todayISO } from "../dates";
import {
  Avatar,
  Chip,
  DangerAction,
  EmptyState,
  StatusSegments,
  TextInput,
  btnPrimary,
  panelCls,
  useToast,
} from "../ui";
import { IconListChecks, IconPlus, IconSearch } from "../icons";
import { TaskModal } from "../modals";

type Tab = "all" | "todo" | "active" | "done" | "late";

const DUE_TONE_CLS: Record<string, string> = {
  late: "text-coral bg-coral/10 border-coral/30",
  today: "text-amber bg-amber/10 border-amber/30",
  soon: "text-sky bg-sky/10 border-sky/30",
  later: "text-mut bg-panel2 border-line2",
};

const RANK: Record<Task["status"], number> = { active: 0, todo: 1, done: 2 };

export function Tasks() {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const today = todayISO();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ task: Task | null } | null>(null);

  const rows = useMemo(
    () =>
      state.tasks
        .map((t) => {
          const team = state.teams.find((x) => x.id === t.teamId) ?? null;
          const members = involvedIds(state, t)
            .map((id) => state.people.find((p) => p.id === id))
            .filter((p): p is NonNullable<typeof p> => !!p);
          const overdue = t.dueDate < today && t.status !== "done";
          return { t, team, members, overdue };
        })
        .sort((a, b) => RANK[a.t.status] - RANK[b.t.status] || a.t.dueDate.localeCompare(b.t.dueDate)),
    [state, today]
  );

  const counts: Record<Tab, number> = {
    all: rows.length,
    todo: rows.filter((r) => r.t.status === "todo").length,
    active: rows.filter((r) => r.t.status === "active").length,
    done: rows.filter((r) => r.t.status === "done").length,
    late: rows.filter((r) => r.overdue).length,
  };

  const visible = rows
    .filter((r) => {
      if (tab === "late") return r.overdue;
      if (tab === "all") return true;
      return r.t.status === tab;
    })
    .filter((r) =>
      (r.t.title + " " + r.t.description + " " + (r.team?.name ?? "")).toLowerCase().includes(query.trim().toLowerCase())
    );

  const setStatus = (task: Task, status: Task["status"]) => {
    if (task.status === status) return;
    dispatch({ type: "SET_TASK_STATUS", id: task.id, status });
    if (status === "done") {
      const n = involvedIds(state, task).length;
      push(
        n > 0
          ? `"${task.title}" done — completion logged for ${n} record${n === 1 ? "" : "s"}`
          : `"${task.title}" marked done`
      );
    } else if (status === "active") {
      push(`"${task.title}" is now in progress`);
    } else {
      push(`"${task.title}" moved back to the queue`);
    }
  };

  const remove = (t: Task) => {
    dispatch({ type: "REMOVE_TASK", id: t.id });
    push(`Task "${t.title}" deleted`, "warn");
  };

  const TABS: { key: Tab; label: string; dot?: string }[] = [
    { key: "all", label: "All" },
    { key: "todo", label: "To do", dot: "bg-sky" },
    { key: "active", label: "In progress", dot: "bg-amber" },
    { key: "done", label: "Done", dot: "bg-mint" },
    { key: "late", label: "Overdue", dot: "bg-coral" },
  ];

  return (
    <div className="space-y-4">
      <header className="reveal flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-none">Tasks</h1>
          <p className="text-mut text-sm mt-2">
            {counts.all - counts.done} open ·{" "}
            <span className={counts.late > 0 ? "text-coral font-medium" : ""}>
              {counts.late} overdue
            </span>{" "}
            · {counts.done} completed
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setModal({ task: null })}>
          <IconPlus className="w-4 h-4" /> New task
        </button>
      </header>

      <div className="reveal flex flex-wrap items-center gap-2.5" style={{ animationDelay: "70ms" }}>
        <div className="relative w-full sm:w-64">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <TextInput
            className="pl-9"
            placeholder="Search tasks or teams…"
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
            title="Nothing on the books"
            body="Create a task, point it at a team with a due date, and everyone involved gets it on their record automatically."
            action={
              <button className={btnPrimary} onClick={() => setModal({ task: null })}>
                <IconPlus className="w-4 h-4" /> Create your first task
              </button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className={panelCls}>
          <EmptyState
            icon={<IconSearch className="w-5 h-5" />}
            title="No tasks here"
            body="Nothing matches this tab and search. Try another filter."
          />
        </div>
      ) : (
        <div className={`${panelCls} overflow-hidden`}>
          {visible.map((r, i) => {
            const due = dueLabel(r.t.dueDate);
            const done = r.t.status === "done";
            return (
              <div
                key={r.t.id}
                onClick={() => setModal({ task: r.t })}
                className="reveal group flex flex-wrap sm:flex-nowrap items-center gap-3 px-3.5 sm:px-4 py-3.5 hover:bg-panel2/60 cursor-pointer transition-colors border-b border-line last:border-b-0"
                style={{ animationDelay: `${Math.min(i * 45, 400)}ms` }}
              >
                <StatusSegments value={r.t.status} onChange={(s) => setStatus(r.t, s)} />
                <div className="flex-1 min-w-[200px]">
                  <p className={`text-sm font-semibold leading-tight ${done ? "line-through decoration-line2 text-mut" : ""}`}>
                    {r.t.title}
                  </p>
                  {r.t.description && (
                    <p className="text-xs text-mut truncate mt-0.5">{r.t.description}</p>
                  )}
                </div>
                <div className="hidden md:block shrink-0">
                  {r.team ? (
                    <Chip className={TEAM_COLORS[r.team.color].chip}>
                      <span className={`w-1.5 h-1.5 rounded-full ${TEAM_COLORS[r.team.color].dot}`} />
                      {r.team.name}
                    </Chip>
                  ) : (
                    <span className="text-xs text-dim">No team</span>
                  )}
                </div>
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
                  className={`w-[110px] justify-center shrink-0 ${
                    done ? "text-mint bg-mint/10 border-mint/30" : DUE_TONE_CLS[due.tone]
                  }`}
                >
                  {done
                    ? `done ${r.t.completedAt ? fmtDate(r.t.completedAt) : ""}`
                    : due.text}
                </Chip>
                <DangerAction onConfirm={() => remove(r.t)} label={`Delete ${r.t.title}`} />
              </div>
            );
          })}
        </div>
      )}

      <TaskModal open={modal !== null} task={modal?.task ?? null} onClose={() => setModal(null)} />
    </div>
  );
}
