import { useMemo, useState } from "react";
import type { Person, StatusKey } from "../types";
import { activeTasksFor, personLastEvent, personStatus, teamsOf, useStore } from "../store";
import { STATUS_META, STATUS_ORDER, TEAM_COLORS, KIND_META } from "../meta";
import { fmtDate } from "../dates";
import { Avatar, Chip, DangerAction, EmptyState, StatusPill, TextInput, btnIcon, btnPrimary, panelCls, useToast } from "../ui";
import { IconBriefcase, IconChevronRight, IconPencil, IconSearch, IconUserPlus, IconUsers } from "../icons";
import { PersonModal } from "../modals";

type Filter = StatusKey | "all";

export function People({ onOpenPerson }: { onOpenPerson: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<{ person: Person | null } | null>(null);

  const rows = useMemo(
    () =>
      state.people.map((p) => ({
        p,
        s: personStatus(state, p.id),
        teams: teamsOf(state, p.id),
        load: activeTasksFor(state, p.id),
        last: personLastEvent(state, p.id),
      })),
    [state]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, available: 0, "on-task": 0, absent: 0, sick: 0, leave: 0 };
    rows.forEach((r) => (c[r.s.key] += 1));
    return c;
  }, [rows]);

  const visible = rows
    .filter((r) => filter === "all" || r.s.key === filter)
    .filter((r) =>
      (r.p.name + " " + r.p.role).toLowerCase().includes(query.trim().toLowerCase())
    )
    .sort((a, b) => a.p.name.localeCompare(b.p.name));

  const remove = (p: Person) => {
    dispatch({ type: "REMOVE_PERSON", id: p.id });
    push(`${p.name} removed from the roster`, "warn");
  };

  return (
    <div className="space-y-4">
      <header className="reveal flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-none">People</h1>
          <p className="text-mut text-sm mt-2">
            {state.people.length} subordinate{state.people.length === 1 ? "" : "s"} under your watch
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setModal({ person: null })}>
          <IconUserPlus className="w-4 h-4" /> Add person
        </button>
      </header>

      {/* Toolbar */}
      <div className="reveal flex flex-wrap items-center gap-2.5" style={{ animationDelay: "70ms" }}>
        <div className="relative w-full sm:w-64">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <TextInput
            className="pl-9"
            placeholder="Search name or role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...STATUS_ORDER] as Filter[]).map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  on ? "bg-panel2 border-line2 text-ink" : "border-line text-mut hover:text-ink hover:border-line2"
                }`}
              >
                {f !== "all" && (
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[f as StatusKey].dot} ${counts[f] === 0 ? "opacity-30" : ""}`} />
                )}
                {f === "all" ? "Everyone" : STATUS_META[f as StatusKey].label}
                <span className="font-mono text-[10px] text-dim">{counts[f]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Roster */}
      {state.people.length === 0 ? (
        <div className={panelCls}>
          <EmptyState
            icon={<IconUsers className="w-5 h-5" />}
            title="Your roster is empty"
            body="Add the people who report to you — then log their deeds, absences and assignments."
            action={
              <button className={btnPrimary} onClick={() => setModal({ person: null })}>
                <IconUserPlus className="w-4 h-4" /> Add your first person
              </button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className={panelCls}>
          <EmptyState
            icon={<IconSearch className="w-5 h-5" />}
            title="No matches"
            body="Nobody fits that search and filter combination. Loosen it up a little."
          />
        </div>
      ) : (
        <div className={`${panelCls} divide-y divide-line overflow-hidden`}>
          {visible.map((r, i) => (
            <div
              key={r.p.id}
              onClick={() => onOpenPerson(r.p.id)}
              className="reveal group flex items-center gap-3 px-3.5 sm:px-4 py-3 hover:bg-panel2/60 cursor-pointer transition-colors"
              style={{ animationDelay: `${Math.min(i * 40, 360)}ms` }}
            >
              <Avatar name={r.p.name} hue={r.p.hue} size={38} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate leading-tight">{r.p.name}</p>
                <p className="text-xs text-mut truncate leading-tight mt-0.5">{r.p.role}</p>
              </div>

              <div className="hidden md:flex items-center gap-1.5 w-44 shrink-0">
                {r.teams.length === 0 && <span className="text-xs text-dim">No team</span>}
                {r.teams.slice(0, 2).map((t) => (
                  <Chip key={t.id} className={TEAM_COLORS[t.color].chip}>
                    <span className={`w-1.5 h-1.5 rounded-full ${TEAM_COLORS[t.color].dot}`} />
                    {t.name}
                  </Chip>
                ))}
              </div>

              <div className="w-[104px] shrink-0">
                <StatusPill status={r.s.key} pulse />
              </div>

              <div className="hidden lg:flex items-center gap-1.5 w-48 shrink-0 text-xs">
                {r.load.length === 0 ? (
                  <span className="text-dim">No active task</span>
                ) : (
                  <>
                    <IconBriefcase className="w-3.5 h-3.5 text-amber shrink-0" />
                    <span className="truncate text-mut" title={r.load.map((t) => t.title).join(", ")}>
                      {r.load[0].title}
                      {r.load.length > 1 && ` +${r.load.length - 1}`}
                    </span>
                  </>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-1.5 w-36 shrink-0 text-xs text-mut">
                {r.last ? (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_META[r.last.kind].dot}`} />
                    <span className="font-mono text-[10.5px] shrink-0">{fmtDate(r.last.date)}</span>
                    <span className="truncate" title={r.last.title}>
                      {KIND_META[r.last.kind].label}
                    </span>
                  </>
                ) : (
                  <span className="text-dim">No record yet</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  className={`${btnIcon} hover:text-amber`}
                  title="Edit"
                  onClick={() => setModal({ person: r.p })}
                >
                  <IconPencil className="w-4 h-4" />
                </button>
                <DangerAction onConfirm={() => remove(r.p)} label={`Remove ${r.p.name}`} />
              </div>

              <IconChevronRight className="hidden sm:block w-4 h-4 text-dim group-hover:text-mut shrink-0 transition-colors" />
            </div>
          ))}
        </div>
      )}

      <PersonModal open={modal !== null} person={modal?.person ?? null} onClose={() => setModal(null)} />
    </div>
  );
}
