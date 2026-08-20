import { useMemo } from "react";
import { personStatus, useStore } from "../store";
import { KIND_META, STATUS_META, STATUS_ORDER, TEAM_COLORS } from "../meta";
import {
  addDays,
  dueLabel,
  fmtDate,
  fmtDateFull,
  relTime,
  todayISO,
  weekNumber,
  weekdayLetter,
} from "../dates";
import { Avatar, Chip, EmptyState, StatusPill, panelCls } from "../ui";
import { IconCalendar, IconCheck, IconChevronRight, IconInbox } from "../icons";
import { useI18n } from "../i18n";
import type { ViewKey } from "../types";

const DUE_TONE_CLS: Record<string, string> = {
  late: "text-coral bg-coral/10 border-coral/30",
  today: "text-amber bg-amber/10 border-amber/30",
  soon: "text-sky bg-sky/10 border-sky/30",
  later: "text-mut bg-panel2 border-line2",
};

export function Dashboard({
  onOpenPerson,
  onNavigate,
}: {
  onOpenPerson: (id: string) => void;
  onNavigate: (v: ViewKey) => void;
}) {
  const { state } = useStore();
  const { t, tp } = useI18n();
  const today = todayISO();

  const roster = useMemo(
    () =>
      state.people.map((p) => {
        const s = personStatus(state, p.id);
        return { p, s };
      }),
    [state]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { available: 0, "on-task": 0, absent: 0, sick: 0, leave: 0 };
    roster.forEach((r) => (c[r.s.key] += 1));
    return c;
  }, [roster]);

  const openTasks = state.tasks.filter((t) => t.status !== "done");
  const overdue = openTasks.filter((t) => t.dueDate < today);
  const dueSoon = openTasks.filter((t) => t.dueDate >= today && t.dueDate <= addDays(today, 7));

  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    return days.map((d) => ({
      iso: d,
      count: state.events.filter((e) => e.date === d).length,
    }));
  }, [state.events, today]);
  const weekTotal = week.reduce((n, d) => n + d.count, 0);
  const weekMax = Math.max(...week.map((d) => d.count), 1);

  const recent = useMemo(
    () =>
      [...state.events]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8)
        .map((e) => ({ e, person: state.people.find((p) => p.id === e.personId) }))
        .filter((x) => x.person),
    [state]
  );

  const radar = [...openTasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  const total = state.people.length;

  /* -------- today's plan -------- */
  const runningToday = useMemo(
    () =>
      state.tasks
        .filter((x) => x.status !== "done" && x.startDate <= today && today <= x.dueDate)
        .sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || a.dueDate.localeCompare(b.dueDate)),
    [state.tasks, today]
  );

  const outToday = useMemo(
    () =>
      roster
        .filter((r) => r.s.key === "absent" || r.s.key === "sick" || r.s.key === "leave")
        .map((r) => {
          const kindOf = { absent: "absence", sick: "sick", leave: "leave" } as const;
          const ev = state.events
            .filter(
              (e) =>
                e.personId === r.p.id &&
                e.kind === kindOf[r.s.key as "absent" | "sick" | "leave"] &&
                e.date <= today &&
                (e.endDate ?? e.date) >= today
            )
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          return { p: r.p, ev };
        }),
    [roster, state.events, today]
  );

  const loggedToday = useMemo(
    () =>
      state.events
        .filter((e) => e.date === today)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6)
        .map((e) => ({ e, person: state.people.find((p) => p.id === e.personId) }))
        .filter((x) => x.person),
    [state, today]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="reveal flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <p className="font-mono text-[11px] text-mut uppercase tracking-[0.2em] mb-2.5">
            {fmtDateFull(today)} · {t("cal.weekN", { n: weekNumber(today) })}
          </p>
          <h1 className="font-display font-bold text-4xl sm:text-[44px] tracking-tight leading-none">
            {t("dash.title")}
          </h1>
          <p className="text-mut text-sm mt-2.5 max-w-xl">{t("dash.sub")}</p>
        </div>
        <div className="flex items-baseline gap-2.5 pb-1">
          <span className="font-display font-bold text-5xl text-mint leading-none">
            {counts.available}
          </span>
          <span className="text-sm text-mut leading-snug">
            {t("dash.freeOf", { n: total })}
            <br />
            {t("dash.rightNow")}
          </span>
        </div>
      </header>

      {/* Floor composition */}
      <section className={`${panelCls} p-4 sm:p-5 reveal`} style={{ animationDelay: "60ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut">
            {t("dash.floor")}
          </h2>
          <span className="font-mono text-[11px] text-dim">{t("dash.rosterCount", { n: total })}</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-panel2 border border-line">
          {total > 0 &&
            STATUS_ORDER.filter((k) => counts[k] > 0).map((k) => (
              <div
                key={k}
                title={`${t(STATUS_META[k].key)}: ${counts[k]}`}
                className={`${STATUS_META[k].bar} transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${(counts[k] / total) * 100}%` }}
              />
            ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
          {STATUS_ORDER.map((k) => (
            <span key={k} className="inline-flex items-center gap-2 text-xs text-mut">
              <span className={`w-2 h-2 rounded-full ${STATUS_META[k].dot} ${counts[k] === 0 ? "opacity-25" : ""}`} />
              {t(STATUS_META[k].key)}
              <span className={`font-mono font-semibold ${counts[k] > 0 ? "text-ink" : "text-dim"}`}>
                {counts[k]}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* Stat strip */}
      <section
        className="reveal grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-xl overflow-hidden"
        style={{ animationDelay: "110ms" }}
      >
        {[
          { label: t("dash.openTasks"), value: openTasks.length, cls: "text-amber" },
          { label: t("dash.dueSoon"), value: dueSoon.length, cls: "text-sky" },
          { label: t("dash.overdue"), value: overdue.length, cls: overdue.length ? "text-coral" : "text-mut" },
          { label: t("dash.weekEvents"), value: weekTotal, cls: "text-mint" },
        ].map((s) => (
          <div key={s.label} className="bg-panel px-4 sm:px-5 py-4">
            <p className={`font-display font-bold text-3xl leading-none ${s.cls}`}>{s.value}</p>
            <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-mut mt-2">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Today's plan */}
      <section className={`${panelCls} reveal overflow-hidden`} style={{ animationDelay: "135ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 pt-4 pb-2">
          <div>
            <h2 className="font-display font-semibold text-lg leading-tight">{t("dash.plan")}</h2>
            <p className="text-xs text-mut mt-0.5">{t("dash.planSub")}</p>
          </div>
          <button
            onClick={() => onNavigate("calendar")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-mut hover:text-mint transition-colors"
          >
            <IconCalendar className="w-3.5 h-3.5" /> {t("dash.seeCalendar")}
            <IconChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
          {/* running tasks */}
          <div className="px-3 sm:px-4 pb-3 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut px-1.5 py-1.5">
              {t("dash.running")} · {runningToday.length}
            </p>
            {runningToday.length === 0 && (
              <p className="text-xs text-dim px-1.5 py-3">{t("dash.runningEmpty")}</p>
            )}
            {runningToday.map((task) => {
              const team = state.teams.find((x) => x.id === task.teamId);
              const color = team ? TEAM_COLORS[team.color] : null;
              const due = dueLabel(task.dueDate);
              return (
                <button
                  key={task.id}
                  onClick={() => onNavigate("tasks")}
                  className="w-full flex items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-panel2/70 text-left transition-colors group"
                >
                  <span className={`w-1 self-stretch rounded-full shrink-0 ${color?.bar ?? "bg-line2"}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold truncate group-hover:text-ink">
                      {task.title}
                    </span>
                    <span className="block text-[11px] text-mut truncate">
                      {team?.name ?? t("tasks.noTeam")} · {fmtDate(task.startDate)} → {fmtDate(task.dueDate)}
                    </span>
                  </span>
                  <Chip className={DUE_TONE_CLS[due.tone]}>{due.text}</Chip>
                </button>
              );
            })}
          </div>

          {/* out today */}
          <div className="px-3 sm:px-4 pb-3 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut px-1.5 py-1.5">
              {t("dash.out")} · {outToday.length}
            </p>
            {outToday.length === 0 && (
              <p className="flex items-center gap-2 text-xs text-mint px-1.5 py-3">
                <IconCheck className="w-3.5 h-3.5" /> {t("dash.outEmpty")}
              </p>
            )}
            {outToday.map(({ p, ev }) => {
              const kind = ev?.kind ?? "absence";
              const m = KIND_META[kind];
              const until = ev?.endDate && ev.endDate > today ? ev.endDate : null;
              return (
                <button
                  key={p.id}
                  onClick={() => onOpenPerson(p.id)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-panel2/70 text-left transition-colors group"
                >
                  <Avatar name={p.name} hue={p.hue} size={30} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold truncate group-hover:text-ink">
                      {p.name}
                    </span>
                    <span className="block text-[11px] text-mut truncate">
                      {ev?.title || t("dash.noReason")}
                      {until && <> · {t("dash.until", { d: fmtDate(until) })}</>}
                    </span>
                  </span>
                  <Chip className={m.chip}>
                    <m.Icon className="w-3 h-3" /> {t(m.key)}
                  </Chip>
                </button>
              );
            })}
          </div>

          {/* logged today */}
          <div className="px-3 sm:px-4 pb-3 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut px-1.5 py-1.5">
              {t("dash.loggedToday")} · {loggedToday.length}
            </p>
            {loggedToday.length === 0 && (
              <p className="text-xs text-dim px-1.5 py-3">{t("dash.loggedEmpty")}</p>
            )}
            {loggedToday.map(({ e, person }) => {
              const m = KIND_META[e.kind];
              return (
                <button
                  key={e.id}
                  onClick={() => onOpenPerson(e.personId)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-panel2/70 text-left transition-colors group"
                >
                  <Avatar name={person!.name} hue={person!.hue} size={30} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium truncate group-hover:text-ink">
                      {e.title}
                    </span>
                    <span className="block text-[11px] text-mut truncate">
                      {person!.name} · {relTime(e.createdAt)}
                    </span>
                  </span>
                  <Chip className={m.chip}>
                    <m.Icon className="w-3 h-3" />
                  </Chip>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Floor board */}
          <section className={`${panelCls} reveal`} style={{ animationDelay: "160ms" }}>
            <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-1">
              <h2 className="font-display font-semibold text-lg">{t("dash.whoWhere")}</h2>
              <button
                onClick={() => onNavigate("people")}
                className="inline-flex items-center gap-1 text-xs text-mut hover:text-mint transition-colors"
              >
                {t("dash.fullRoster")} <IconChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-4 sm:px-5 pb-4">
              {total === 0 && (
                <EmptyState
                  icon={<IconInbox className="w-5 h-5" />}
                  title={t("people.emptyTitle")}
                  body={t("people.emptyBody")}
                />
              )}
              {STATUS_ORDER.map((k) => {
                const people = roster.filter((r) => r.s.key === k);
                return (
                  <div
                    key={k}
                    className="flex flex-col sm:flex-row sm:items-start gap-2.5 py-3 border-b border-line last:border-b-0"
                  >
                    <div className="sm:w-[118px] shrink-0 sm:pt-0.5">
                      <StatusPill status={k} pulse />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {people.length === 0 && (
                        <span className="text-xs text-dim py-1.5">{t("dash.nobody")}</span>
                      )}
                      {people.map(({ p, s }) => (
                        <button
                          key={p.id}
                          onClick={() => onOpenPerson(p.id)}
                          className="group flex items-center gap-2.5 rounded-lg border border-line2 bg-panel2/70 hover:bg-raise pl-1.5 pr-3 py-1.5 text-left transition-all duration-150 hover:-translate-y-0.5"
                        >
                          <Avatar name={p.name} hue={p.hue} size={26} />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold leading-tight group-hover:text-ink">
                              {p.name}
                            </span>
                            <span className="block text-[11px] text-mut leading-tight truncate max-w-[170px]">
                              {k === "available" ? p.role : s.detail}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Deadline radar */}
          <section className={`${panelCls} reveal`} style={{ animationDelay: "210ms" }}>
            <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-1">
              <h2 className="font-display font-semibold text-lg">{t("dash.radar")}</h2>
              <button
                onClick={() => onNavigate("tasks")}
                className="inline-flex items-center gap-1 text-xs text-mut hover:text-mint transition-colors"
              >
                {t("dash.allTasks")} <IconChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-2 sm:px-3 pb-3">
              {radar.length === 0 && (
                <p className="text-sm text-dim px-3 py-6 text-center">{t("dash.nothingOpen")}</p>
              )}
              {radar.map((task) => {
                const due = dueLabel(task.dueDate);
                const team = state.teams.find((x) => x.id === task.teamId);
                const memberIds = [
                  ...new Set([...(team?.memberIds ?? []), ...task.assigneeIds]),
                ].filter((id) => state.people.some((p) => p.id === id));
                return (
                  <button
                    key={task.id}
                    onClick={() => onNavigate("tasks")}
                    className="w-full flex items-center gap-3 px-2.5 sm:px-3 py-2.5 rounded-lg hover:bg-panel2/70 text-left transition-colors group"
                  >
                    <Chip className={`w-[108px] justify-center shrink-0 ${DUE_TONE_CLS[due.tone]}`}>
                      {due.text}
                    </Chip>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate group-hover:text-ink">
                        {task.title}
                      </span>
                      <span className="block text-[11px] text-mut truncate">
                        {team ? team.name : t("dash.noTeam")} ·{" "}
                        <span className="font-mono">
                          {fmtDate(task.startDate)} → {fmtDate(task.dueDate)}
                        </span>{" "}
                        · {task.status === "active" ? t("dash.inProgress") : t("dash.notStarted")}
                      </span>
                    </span>
                    <span className="flex -space-x-1.5 shrink-0">
                      {memberIds.slice(0, 4).map((id) => {
                        const p = state.people.find((x) => x.id === id)!;
                        return <Avatar key={id} name={p.name} hue={p.hue} size={24} className="ring-2 ring-panel" />;
                      })}
                      {memberIds.length > 4 && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-panel2 border border-line2 text-[10px] font-mono text-mut ring-2 ring-panel">
                          +{memberIds.length - 4}
                        </span>
                      )}
                    </span>
                    <IconChevronRight className="w-4 h-4 text-dim group-hover:text-mut shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Week pulse */}
          <section className={`${panelCls} p-4 sm:p-5 reveal`} style={{ animationDelay: "260ms" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg">{t("dash.pulse")}</h2>
              <span className="font-mono text-[11px] text-dim">{t("dash.loggedCount", { n: weekTotal })}</span>
            </div>
            <div className="flex items-end gap-2 h-24">
              {week.map((d, i) => (
                <div key={d.iso} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className={`text-[10px] font-mono ${d.count > 0 ? "text-mut" : "text-dim/60"}`}>
                    {d.count > 0 ? d.count : "·"}
                  </span>
                  <div
                    title={tp("dash.event", d.count, { d: fmtDate(d.iso) })}
                    className={`w-full rounded-sm bar-grow ${
                      d.iso === today ? "bg-mint/80" : d.count > 0 ? "bg-line2" : "bg-line"
                    }`}
                    style={{
                      height: `${Math.max((d.count / weekMax) * 100, 5)}%`,
                      animationDelay: `${300 + i * 60}ms`,
                    }}
                  />
                  <span
                    className={`text-[10px] font-mono ${d.iso === today ? "text-mint font-semibold" : "text-dim"}`}
                  >
                    {weekdayLetter(d.iso)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Recent activity */}
          <section className={`${panelCls} reveal`} style={{ animationDelay: "310ms" }}>
            <h2 className="font-display font-semibold text-lg px-4 sm:px-5 pt-4 pb-1">
              {t("dash.latest")}
            </h2>
            <div className="pb-2">
              {recent.length === 0 && (
                <p className="text-sm text-dim px-5 py-6 text-center">{t("dash.noEvents")}</p>
              )}
              {recent.map(({ e, person }) => {
                const m = KIND_META[e.kind];
                return (
                  <button
                    key={e.id}
                    onClick={() => onOpenPerson(e.personId)}
                    className="w-full flex items-start gap-2.5 px-4 sm:px-5 py-2.5 hover:bg-panel2/70 text-left transition-colors"
                  >
                    <Avatar name={person!.name} hue={person!.hue} size={28} className="mt-0.5" />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold">{person!.name}</span>
                        <Chip className={m.chip}>
                          <m.Icon className="w-3 h-3" /> {t(m.key)}
                        </Chip>
                      </span>
                      <span className="block text-[13px] text-mut truncate mt-0.5">{e.title}</span>
                    </span>
                    <span className="text-[10.5px] font-mono text-dim whitespace-nowrap mt-1">
                      {relTime(e.createdAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
