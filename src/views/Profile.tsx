import { useMemo, useState } from "react";
import type { EventKind } from "../types";
import { personStatus, tasksFor, teamsOf, useStore } from "../store";
import { KIND_META, TEAM_COLORS } from "../meta";
import { daysBetween, dueLabel, fmtDate, fmtDateYear, relTime, spanDays, todayISO } from "../dates";
import {
  Avatar,
  Chip,
  DangerAction,
  EmptyState,
  StatusPill,
  btnGhost,
  btnPrimary,
  panelCls,
  useToast,
} from "../ui";
import {
  IconArrowLeft,
  IconBriefcase,
  IconCalendar,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
} from "../icons";
import { EventModal, PersonModal } from "../modals";

const DUE_TONE_CLS: Record<string, string> = {
  late: "text-coral bg-coral/10 border-coral/30",
  today: "text-amber bg-amber/10 border-amber/30",
  soon: "text-sky bg-sky/10 border-sky/30",
  later: "text-mut bg-panel2 border-line2",
};

type KindFilter = EventKind | "all";

export function Profile({
  personId,
  onBack,
  onDeleted,
}: {
  personId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const [filter, setFilter] = useState<KindFilter>("all");
  const [eventOpen, setEventOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const events = useMemo(
    () =>
      state.events
        .filter((e) => e.personId === personId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [state.events, personId]
  );

  const person = state.people.find((p) => p.id === personId);
  if (!person) return null;

  const status = personStatus(state, personId);
  const teams = teamsOf(state, personId);
  const load = tasksFor(state, personId);
  const tenure = Math.max(daysBetween(person.joinedAt, todayISO()), 0);

  const kindStats = (["commendation", "misconduct", "absence", "sick", "leave", "task", "observation"] as EventKind[]).map(
    (k) => {
      const list = events.filter((e) => e.kind === k);
      const isRange = k === "absence" || k === "sick" || k === "leave";
      const days = list.reduce((n, e) => n + spanDays(e.date, e.endDate), 0);
      return { k, n: list.length, days, ranged: isRange };
    }
  );

  const presentKinds = kindStats.filter((s) => s.n > 0).map((s) => s.k);
  const visible = events.filter((e) => filter === "all" || e.kind === filter);

  const removeEvent = (id: string, title: string) => {
    dispatch({ type: "REMOVE_EVENT", id });
    push(`"${title}" removed from the record`, "warn");
  };

  const removePerson = () => {
    dispatch({ type: "REMOVE_PERSON", id: person.id });
    push(`${person.name} removed from the roster`, "warn");
    onDeleted();
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="reveal inline-flex items-center gap-2 text-sm text-mut hover:text-ink transition-colors"
      >
        <IconArrowLeft className="w-4 h-4" /> Back to roster
      </button>

      {/* Header */}
      <section className={`${panelCls} p-4 sm:p-6 reveal`} style={{ animationDelay: "50ms" }}>
        <div className="flex flex-wrap gap-5">
          <Avatar name={person.name} hue={person.hue} size={76} />
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight leading-none">
                {person.name}
              </h1>
              <StatusPill status={status.key} pulse />
            </div>
            <p className="text-mut text-sm mt-2">
              {person.role}
              {teams.length > 0 && (
                <>
                  {" · "}
                  {teams.map((t) => t.name).join(", ")}
                </>
              )}
            </p>
            <p className="text-xs text-dim mt-1">
              {status.key === "available"
                ? "Free for new assignments right now."
                : status.key === "on-task"
                ? `Working on: ${status.detail}`
                : status.detail}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-xs text-mut">
              {person.email && (
                <span className="inline-flex items-center gap-1.5">
                  <IconMail className="w-3.5 h-3.5 text-dim" /> {person.email}
                </span>
              )}
              {person.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <IconPhone className="w-3.5 h-3.5 text-dim" /> {person.phone}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <IconCalendar className="w-3.5 h-3.5 text-dim" /> Joined {fmtDateYear(person.joinedAt)} ·{" "}
                <span className="font-mono text-[10.5px]">{tenure}d on roster</span>
              </span>
            </div>
          </div>
          <div className="flex sm:flex-col gap-2 shrink-0">
            <button className={btnPrimary} onClick={() => setEventOpen(true)}>
              <IconPlus className="w-4 h-4" /> Record event
            </button>
            <button className={btnGhost} onClick={() => setEditOpen(true)}>
              <IconPencil className="w-4 h-4" /> Edit
            </button>
            <DangerAction onConfirm={removePerson} label={`Remove ${person.name}`} />
          </div>
        </div>
      </section>

      {/* Record strip */}
      <section
        className="reveal grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-line border border-line rounded-xl overflow-hidden"
        style={{ animationDelay: "110ms" }}
      >
        {kindStats.map((s) => {
          const m = KIND_META[s.k];
          return (
            <div key={s.k} className="bg-panel px-3 py-3.5">
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border ${m.node}`}>
                <m.Icon className="w-3.5 h-3.5" />
              </span>
              <p className="font-display font-bold text-xl leading-none mt-2">
                {s.ranged ? s.days : s.n}
                {s.ranged && <span className="text-xs text-mut font-body font-normal">d</span>}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-mut mt-1">
                {s.ranged ? `${m.label} days` : m.label + (s.n === 1 ? "" : "s")}
              </p>
            </div>
          );
        })}
      </section>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Current load */}
        <section className={`${panelCls} reveal`} style={{ animationDelay: "160ms" }}>
          <h2 className="font-display font-semibold text-lg px-4 sm:px-5 pt-4 pb-1">Current load</h2>
          <div className="px-2.5 sm:px-3.5 pb-3">
            {load.length === 0 && (
              <p className="text-sm text-dim px-2 py-5 text-center">
                No open tasks — available for new work.
              </p>
            )}
            {load.map((t) => {
              const due = dueLabel(t.dueDate);
              const team = state.teams.find((x) => x.id === t.teamId);
              return (
                <div key={t.id} className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-panel2/70 transition-colors">
                  <IconBriefcase
                    className={`w-4 h-4 shrink-0 ${t.status === "active" ? "text-amber" : "text-sky"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{t.title}</p>
                    <p className="text-[11px] text-mut truncate">
                      {team?.name ?? "Individual"} · {t.status === "active" ? "in progress" : "queued"}
                    </p>
                  </div>
                  <Chip className={DUE_TONE_CLS[due.tone]}>{due.text}</Chip>
                </div>
              );
            })}
          </div>
        </section>

        {/* Service record */}
        <section className={`${panelCls} lg:col-span-2 reveal`} style={{ animationDelay: "210ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 pt-4 pb-3">
            <div>
              <h2 className="font-display font-semibold text-lg">Service record</h2>
              <p className="text-xs text-mut mt-0.5">
                {events.length} entr{events.length === 1 ? "y" : "ies"} on file
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 px-4 sm:px-5 pb-3">
            {(["all", ...presentKinds] as KindFilter[]).map((f) => {
              const on = filter === f;
              const n = f === "all" ? events.length : events.filter((e) => e.kind === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                    on ? "bg-panel2 border-line2 text-ink" : "border-line text-mut hover:text-ink hover:border-line2"
                  }`}
                >
                  {f !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${KIND_META[f as EventKind].dot}`} />}
                  {f === "all" ? "Everything" : KIND_META[f as EventKind].label}
                  <span className="font-mono text-[10px] text-dim">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="px-4 sm:px-6 pb-5 pt-1">
            {visible.length === 0 && (
              <EmptyState
                icon={<IconCalendar className="w-5 h-5" />}
                title="A clean sheet"
                body="Nothing logged under this filter yet. Record the first deed, absence or observation."
                action={
                  <button className={btnPrimary} onClick={() => setEventOpen(true)}>
                    <IconPlus className="w-4 h-4" /> Record an event
                  </button>
                }
              />
            )}
            {visible.map((e, i) => {
              const m = KIND_META[e.kind];
              return (
                <div
                  key={e.id}
                  className="reveal group relative pl-12 pb-5 last:pb-0"
                  style={{ animationDelay: `${Math.min(i * 45, 400)}ms` }}
                >
                  {i < visible.length - 1 && (
                    <span className="absolute left-[15px] top-9 bottom-0 w-px bg-line" aria-hidden />
                  )}
                  <span
                    className={`absolute left-0 top-0 w-8 h-8 rounded-full border inline-flex items-center justify-center ${m.node}`}
                  >
                    <m.Icon className="w-4 h-4" />
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{e.title}</p>
                      {e.note && <p className="text-xs text-mut mt-1 leading-relaxed">{e.note}</p>}
                      <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                        <Chip className={m.chip}>{m.label}</Chip>
                        <span className="font-mono text-[10.5px] text-dim">
                          {fmtDate(e.date)}
                          {e.endDate ? ` → ${fmtDate(e.endDate)}` : ""} · logged {relTime(e.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                      <DangerAction onConfirm={() => removeEvent(e.id, e.title)} label="Remove entry" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <EventModal open={eventOpen} onClose={() => setEventOpen(false)} personId={person.id} />
      <PersonModal open={editOpen} onClose={() => setEditOpen(false)} person={person} />
    </div>
  );
}
