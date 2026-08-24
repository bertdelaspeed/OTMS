import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { EventKind, PersonEvent, Task } from "../types";
import { involvedIds, useStore } from "../store";
import { KIND_META, TEAM_COLORS } from "../meta";
import {
  addDays,
  addMonthsISO,
  dueLabel,
  fmtDate,
  monthEndISO,
  monthStartISO,
  monthTitle,
  overlapDays,
  startOfWeekISO,
  toISO,
  todayISO,
  weekNumber,
  weekdayShort,
} from "../dates";
import { Avatar, Chip, EmptyState, Segmented, btnGhost, btnIcon, panelCls } from "../ui";
import {
  IconActivity,
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconListChecks,
  IconStar,
  IconX,
} from "../icons";
import { useI18n } from "../i18n";

type Period = "week" | "month";

interface DayEntry {
  ts: string;
  node: ReactNode;
}

const RANGE_KINDS: EventKind[] = ["absence", "sick", "leave"];

type Cat = "taskDone" | "taskAssigned" | EventKind;

const CAT_DEFS: { key: Cat; dot: string }[] = [
  { key: "taskDone", dot: "bg-mint" },
  { key: "taskAssigned", dot: "bg-sky" },
  { key: "commendation", dot: "bg-amber" },
  { key: "misconduct", dot: "bg-coral" },
  { key: "absence", dot: "bg-rose" },
  { key: "sick", dot: "bg-cyan" },
  { key: "leave", dot: "bg-sky" },
  { key: "permission", dot: "bg-orchid" },
  { key: "observation", dot: "bg-sage" },
];

export function Activity({ onOpenPerson }: { onOpenPerson: (id: string) => void }) {
  const { state } = useStore();
  const { t, tp } = useI18n();
  const today = todayISO();

  const [period, setPeriod] = useState<Period>("week");
  const [cursor, setCursor] = useState(today);

  /* -------- filters -------- */
  const [cats, setCats] = useState<Cat[]>([]);
  const [personId, setPersonId] = useState("");
  const [teamId, setTeamId] = useState("");

  const hasFilters = cats.length > 0 || personId !== "" || teamId !== "";
  const catActive = (c: Cat) => cats.length === 0 || cats.includes(c);
  const teamMembers = useMemo(
    () => (teamId !== "" ? state.teams.find((tm) => tm.id === teamId)?.memberIds ?? [] : null),
    [state.teams, teamId]
  );
  const personMatch = (pid: string) =>
    personId !== "" ? pid === personId : teamMembers ? teamMembers.includes(pid) : true;
  const taskMatch = (x: Task) =>
    personId === "" && teamId === "" ? true : involvedIds(state, x).some(personMatch);
  const clearFilters = () => {
    setCats([]);
    setPersonId("");
    setTeamId("");
  };
  const catLabel = (c: Cat) =>
    c === "taskDone"
      ? t("act.taskDone")
      : c === "taskAssigned"
      ? t("act.taskAssigned")
      : t(KIND_META[c].key);

  const start = period === "week" ? startOfWeekISO(cursor) : monthStartISO(cursor);
  const end = period === "week" ? addDays(startOfWeekISO(cursor), 6) : monthEndISO(cursor);

  const navigate = (dir: -1 | 1) =>
    setCursor(period === "week" ? addDays(cursor, dir * 7) : addMonthsISO(cursor, dir));

  const periodLabel =
    period === "week"
      ? `${t("cal.weekN", { n: weekNumber(start) })} · ${fmtDate(start)} – ${fmtDate(end)}`
      : monthTitle(start);

  /* -------- aggregate stats (filters applied here cascade everywhere) -------- */
  const agg = useMemo(() => {
    const evs = state.events
      .filter((e) => e.date <= end && (e.endDate ?? e.date) >= start)
      .filter((e) => {
        if (!personMatch(e.personId)) return false;
        if (e.kind === "task") return catActive("taskDone") || catActive("taskAssigned");
        return catActive(e.kind);
      });
    const count = (k: EventKind) => evs.filter((e) => e.kind === k).length;
    const daysFor = (k: EventKind) =>
      evs.filter((e) => e.kind === k).reduce((n, e) => n + overlapDays(e.date, e.endDate, start, end), 0);
    const completed = state.tasks
      .filter((x) => x.completedAt && x.completedAt >= start && x.completedAt <= end)
      .filter((x) => catActive("taskDone") && taskMatch(x))
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    const assigned = state.tasks
      .filter((x) => {
        const d = toISO(new Date(x.createdAt));
        return d >= start && d <= end;
      })
      .filter((x) => catActive("taskAssigned") && taskMatch(x));
    return {
      evs,
      total: evs.length,
      completed,
      assigned,
      absDays: daysFor("absence"),
      sickDays: daysFor("sick"),
      leaveDays: daysFor("leave"),
      commendations: count("commendation"),
      misconduct: count("misconduct"),
      permissions: count("permission"),
      observations: count("observation"),
      taskEvents: count("task"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, start, end, cats, personId, teamId]);

  /* -------- day by day -------- */
  const days = useMemo(() => {
    const map = new Map<string, { events: PersonEvent[]; done: Task[]; assigned: Task[] }>();
    const put = (d: string) => {
      if (!map.has(d)) map.set(d, { events: [], done: [], assigned: [] });
      return map.get(d)!;
    };
    agg.evs.forEach((e) => put(e.date < start ? start : e.date).events.push(e));
    agg.completed.forEach((x) => put(x.completedAt!).done.push(x));
    agg.assigned.forEach((x) => put(toISO(new Date(x.createdAt))).assigned.push(x));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [agg, start]);

  const buildStream = (day: string, d: { events: PersonEvent[]; done: Task[]; assigned: Task[] }): DayEntry[] => {
    const items: DayEntry[] = [];

    d.events.forEach((e) => {
      const m = KIND_META[e.kind];
      const person = state.people.find((p) => p.id === e.personId);
      items.push({
        ts: e.createdAt,
        node: (
          <button
            key={`e-${e.id}`}
            onClick={() => person && onOpenPerson(person.id)}
            className="w-full flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-panel2/70 text-left transition-colors group"
          >
            {person ? (
              <Avatar name={person.name} hue={person.hue} size={26} className="mt-0.5" />
            ) : (
              <span className="w-[26px] h-[26px] mt-0.5 rounded-full border border-dashed border-line2 shrink-0" />
            )}
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold group-hover:text-ink">{person?.name ?? "—"}</span>
                <Chip className={m.chip}>
                  <m.Icon className="w-3 h-3" /> {t(m.key)}
                </Chip>
                {RANGE_KINDS.includes(e.kind) && e.endDate && e.endDate !== e.date && (
                  <span className="font-mono text-[10px] text-dim">
                    {fmtDate(e.date)} → {fmtDate(e.endDate)}
                  </span>
                )}
                {e.kind === "permission" && e.timeFrom && e.timeTo && (
                  <span className="font-mono text-[10px] text-orchid">
                    {e.timeFrom} – {e.timeTo}
                  </span>
                )}
              </span>
              <span className="block text-[13px] text-mut truncate mt-0.5">{e.title}</span>
            </span>
          </button>
        ),
      });
    });

    d.done.forEach((x) => {
      const team = state.teams.find((tm) => tm.id === x.teamId);
      items.push({
        ts: `${x.completedAt}T12:00:00.000Z`,
        node: (
          <div key={`d-${x.id}`} className="flex items-center gap-2.5 px-2 py-2">
            <span className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-full bg-mint/15 border border-mint/40 text-mint shrink-0">
              <IconCheck className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium truncate">{x.title}</span>
              <span className="block text-[11px] text-mut">
                {team?.name ?? t("tasks.noTeam")} · {t("act.completed")}
              </span>
            </span>
            {team && (
              <Chip className={TEAM_COLORS[team.color].chip}>
                <span className={`w-1.5 h-1.5 rounded-full ${TEAM_COLORS[team.color].dot}`} />
              </Chip>
            )}
          </div>
        ),
      });
    });

    d.assigned.forEach((x) => {
      const team = state.teams.find((tm) => tm.id === x.teamId);
      const due = dueLabel(x.dueDate);
      items.push({
        ts: x.createdAt,
        node: (
          <div key={`a-${x.id}`} className="flex items-center gap-2.5 px-2 py-2">
            <span className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-full bg-sky/15 border border-sky/40 text-sky shrink-0">
              <IconListChecks className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium truncate">{x.title}</span>
              <span className="block text-[11px] text-mut">
                {team?.name ?? t("tasks.noTeam")} · {t("act.assigned")}
              </span>
            </span>
            <Chip
              className={
                due.tone === "late"
                  ? "text-coral bg-coral/10 border-coral/30"
                  : due.tone === "today"
                  ? "text-amber bg-amber/10 border-amber/30"
                  : "text-mut bg-panel2 border-line2"
              }
            >
              {due.text}
            </Chip>
          </div>
        ),
      });
    });

    void day;
    return items.sort((a, b) => b.ts.localeCompare(a.ts));
  };

  /* -------- per person -------- */
  const perPerson = useMemo(() => {
    return state.people
      .map((p) => {
        const mine = agg.evs.filter((e) => e.personId === p.id);
        const count = (k: EventKind) => mine.filter((e) => e.kind === k).length;
        const daysFor = (k: EventKind) =>
          mine.filter((e) => e.kind === k).reduce((n, e) => n + overlapDays(e.date, e.endDate, start, end), 0);
        const r = {
          p,
          commendations: count("commendation"),
          misconduct: count("misconduct"),
          abs: daysFor("absence"),
          sick: daysFor("sick"),
          leave: daysFor("leave"),
          permissions: count("permission"),
          observations: count("observation"),
          taskEvents: count("task"),
          total: mine.length,
        };
        return r;
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.commendations - a.commendations || b.total - a.total || a.p.name.localeCompare(b.p.name));
  }, [state.people, agg, start, end]);

  const isEmpty = agg.total === 0 && agg.completed.length === 0 && agg.assigned.length === 0;

  const mixChips: { label: string; value: number; cls: string; icon: ReactNode }[] = [
    { label: t("kind.commendation"), value: agg.commendations, cls: "text-amber bg-amber/10 border-amber/30", icon: <IconStar className="w-3 h-3" /> },
    { label: t("kind.misconduct"), value: agg.misconduct, cls: "text-coral bg-coral/10 border-coral/30", icon: <KIND_META.misconduct.Icon className="w-3 h-3" /> },
    { label: t("kind.absence"), value: agg.absDays, cls: "text-rose bg-rose/10 border-rose/30", icon: <KIND_META.absence.Icon className="w-3 h-3" /> },
    { label: t("kind.sick"), value: agg.sickDays, cls: "text-cyan bg-cyan/10 border-cyan/30", icon: <KIND_META.sick.Icon className="w-3 h-3" /> },
    { label: t("kind.leave"), value: agg.leaveDays, cls: "text-sky bg-sky/10 border-sky/30", icon: <KIND_META.leave.Icon className="w-3 h-3" /> },
    { label: t("kind.permission"), value: agg.permissions, cls: "text-orchid bg-orchid/10 border-orchid/30", icon: <KIND_META.permission.Icon className="w-3 h-3" /> },
    { label: t("kind.observation"), value: agg.observations, cls: "text-sage bg-sage/10 border-sage/30", icon: <KIND_META.observation.Icon className="w-3 h-3" /> },
    { label: t("kind.task"), value: agg.taskEvents, cls: "text-mint bg-mint/10 border-mint/30", icon: <KIND_META.task.Icon className="w-3 h-3" /> },
  ];

  return (
    <div className="space-y-4">
      <header className="reveal flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-none">{t("act.title")}</h1>
          <p className="text-mut text-sm mt-2 max-w-xl">{t("act.sub")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { value: "week", label: t("cal.week") },
              { value: "month", label: t("cal.month") },
            ]}
          />
          <div className="inline-flex items-center gap-1">
            <button className={btnIcon} onClick={() => navigate(-1)} aria-label="←">
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCursor(today)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                cursor === today
                  ? "border-mint/40 text-mint bg-mint/10"
                  : "border-line2 text-mut hover:text-ink hover:bg-panel2"
              }`}
            >
              {t("cal.today")}
            </button>
            <button className={btnIcon} onClick={() => navigate(1)} aria-label="→">
              <IconChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <p className="reveal font-display font-semibold text-xl -mb-1" style={{ animationDelay: "50ms" }}>
        {periodLabel}
      </p>

      {/* -------- filter bar -------- */}
      <section
        className={`${panelCls} reveal px-4 sm:px-5 py-3.5 space-y-3`}
        style={{ animationDelay: "70ms" }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-mut mr-1.5">
            <IconFilter className="w-3.5 h-3.5" /> {t("act.cats")}
          </span>
          <button
            onClick={() => setCats([])}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
              cats.length === 0
                ? "bg-panel2 border-line2 text-ink"
                : "border-line text-mut hover:text-ink hover:border-line2"
            }`}
          >
            {t("act.catAll")}
          </button>
          {CAT_DEFS.map((c) => {
            const on = cats.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() =>
                  setCats((prev) => (on ? prev.filter((x) => x !== c.key) : [...prev, c.key]))
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  on ? "bg-panel2 border-line2 text-ink" : "border-line text-mut hover:text-ink hover:border-line2"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${on ? "" : "opacity-40"}`} />
                {catLabel(c.key)}
              </button>
            );
          })}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 text-mint px-3 py-1.5 text-xs font-semibold hover:bg-mint/20 transition-all duration-150"
            >
              <IconX className="w-3 h-3" /> {t("act.clear")}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`transition-opacity duration-200 ${personId !== "" ? "opacity-40 pointer-events-none" : ""} inline-flex items-center gap-1.5 flex-wrap`}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut mr-1.5">
              {t("act.team")}
            </span>
            <button
              onClick={() => setTeamId("")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                teamId === ""
                  ? "bg-panel2 border-line2 text-ink"
                  : "border-line text-mut hover:text-ink hover:border-line2"
              }`}
            >
              {t("act.allTeams")}
            </button>
            {state.teams.map((tm) => {
              const on = teamId === tm.id;
              const c = TEAM_COLORS[tm.color];
              return (
                <button
                  key={tm.id}
                  onClick={() => setTeamId(on ? "" : tm.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                    on ? c.chip : "border-line text-mut hover:text-ink hover:border-line2"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${on ? "" : "opacity-40"}`} />
                  {tm.name}
                </button>
              );
            })}
          </span>

          <span className="w-px h-5 bg-line mx-1.5 hidden sm:block" aria-hidden />

          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut mr-1.5">
            {t("act.person")}
          </span>
          <button
            onClick={() => setPersonId("")}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
              personId === ""
                ? "bg-panel2 border-line2 text-ink"
                : "border-line text-mut hover:text-ink hover:border-line2"
            }`}
          >
            {t("act.everyone")}
          </button>
          <span className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5">
            {state.people.map((p) => {
              const on = personId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPersonId(on ? "" : p.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                    on
                      ? "border-mint/50 bg-mint/10 text-ink"
                      : "border-line text-mut hover:border-line2 hover:text-ink"
                  }`}
                >
                  <Avatar name={p.name} hue={p.hue} size={20} />
                  {p.name.split(" ")[0]}
                </button>
              );
            })}
          </span>
        </div>
      </section>

      {isEmpty ? (
        <div className={panelCls}>
          <EmptyState
            icon={hasFilters ? <IconFilter className="w-5 h-5" /> : <IconActivity className="w-5 h-5" />}
            title={hasFilters ? t("act.filteredEmpty") : t("act.emptyTitle")}
            body={hasFilters ? t("act.filteredBody") : t("act.emptyBody")}
            action={
              hasFilters ? (
                <button className={btnGhost} onClick={clearFilters}>
                  <IconX className="w-4 h-4" /> {t("act.clear")}
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* stat tiles */}
          <section
            className="reveal grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-xl overflow-hidden"
            style={{ animationDelay: "90ms" }}
          >
            <div className="bg-panel px-4 sm:px-5 py-4">
              <p className="font-display font-bold text-3xl leading-none text-ink">{agg.total}</p>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-mut mt-2">{t("act.events")}</p>
            </div>
            <div className="bg-panel px-4 sm:px-5 py-4">
              <p className="font-display font-bold text-3xl leading-none text-mint">{agg.completed.length}</p>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-mut mt-2">{t("act.completed")}</p>
            </div>
            <div className="bg-panel px-4 sm:px-5 py-4">
              <p className="font-display font-bold text-3xl leading-none text-sky">{agg.assigned.length}</p>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-mut mt-2">{t("act.assigned")}</p>
            </div>
            <div className="bg-panel px-4 sm:px-5 py-4">
              <p className="font-display font-bold text-3xl leading-none text-rose">
                {agg.absDays + agg.sickDays + agg.leaveDays}
              </p>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-mut mt-2">{t("act.daysOut")}</p>
              <p className="text-[10.5px] text-dim mt-1">
                {t("act.daysOutMix", { a: agg.absDays, s: agg.sickDays, l: agg.leaveDays })}
              </p>
            </div>
          </section>

          {/* record mix */}
          <section className={`${panelCls} px-4 sm:px-5 py-3.5 reveal`} style={{ animationDelay: "130ms" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut mr-2">
                {t("act.mix")}
              </span>
              {mixChips.map((c) => (
                <Chip key={c.label} className={c.cls}>
                  {c.icon}
                  {c.label}
                  <span className="font-mono font-semibold">{c.value}</span>
                </Chip>
              ))}
            </div>
          </section>

          <div className="grid lg:grid-cols-3 gap-4 items-start">
            {/* day by day */}
            <section className={`${panelCls} lg:col-span-2 reveal`} style={{ animationDelay: "170ms" }}>
              <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-2">
                <h2 className="font-display font-semibold text-lg">{t("act.dayByDay")}</h2>
                {hasFilters && (
                  <Chip className="text-mint bg-mint/10 border-mint/30">
                    <IconFilter className="w-3 h-3" /> {t("act.active")}
                  </Chip>
                )}
              </div>
              <div className="px-3 sm:px-4 pb-4 max-h-[640px] overflow-y-auto">
                {days.map(([day, d]) => {
                  const n = d.events.length + d.done.length + d.assigned.length;
                  const stream = buildStream(day, d);
                  const isToday = day === today;
                  return (
                    <div key={day} className="relative pl-5 pb-2 last:pb-0">
                      <span className="absolute left-[7px] top-6 bottom-0 w-px bg-line" aria-hidden />
                      <span
                        className={`absolute left-0 top-2.5 w-[15px] h-[15px] rounded-full border-2 ${
                          isToday ? "bg-mint border-mint" : "bg-panel2 border-line2"
                        }`}
                      />
                      <div className="flex items-center gap-2.5 py-1.5">
                        <p className="font-display font-semibold text-sm">
                          {weekdayShort(day)} {fmtDate(day)}
                        </p>
                        {isToday && (
                          <Chip className="text-mint bg-mint/10 border-mint/30">{t("cal.today")}</Chip>
                        )}
                        <span className="font-mono text-[10.5px] text-dim">{tp("act.entry", n)}</span>
                      </div>
                      <div className="space-y-0.5">{stream.map((s) => s.node)}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* right column */}
            <div className="space-y-4">
              {/* by person */}
              <section className={`${panelCls} reveal`} style={{ animationDelay: "210ms" }}>
                <h2 className="font-display font-semibold text-lg px-4 sm:px-5 pt-4 pb-2">{t("act.byPerson")}</h2>
                <div className="px-2.5 sm:px-3.5 pb-3">
                  {perPerson.length === 0 && (
                    <p className="text-sm text-dim px-2 py-5 text-center">{t("act.noOne")}</p>
                  )}
                  {perPerson.map((r) => (
                    <button
                      key={r.p.id}
                      onClick={() => onOpenPerson(r.p.id)}
                      className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-panel2/70 text-left transition-colors"
                    >
                      <Avatar name={r.p.name} hue={r.p.hue} size={30} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold truncate">{r.p.name}</span>
                        <span className="block text-[10.5px] text-mut">{tp("act.entry", r.total)}</span>
                      </span>
                      <span className="flex items-center gap-1 flex-wrap justify-end max-w-[130px]">
                        {r.commendations > 0 && (
                          <Chip className="text-amber bg-amber/10 border-amber/30 px-1.5">
                            <IconStar className="w-3 h-3" /> {r.commendations}
                          </Chip>
                        )}
                        {r.misconduct > 0 && (
                          <Chip className="text-coral bg-coral/10 border-coral/30 px-1.5">
                            <KIND_META.misconduct.Icon className="w-3 h-3" /> {r.misconduct}
                          </Chip>
                        )}
                        {r.abs > 0 && (
                          <Chip className="text-rose bg-rose/10 border-rose/30 px-1.5">{r.abs}d</Chip>
                        )}
                        {r.sick > 0 && (
                          <Chip className="text-cyan bg-cyan/10 border-cyan/30 px-1.5">{r.sick}d</Chip>
                        )}
                        {r.leave > 0 && (
                          <Chip className="text-sky bg-sky/10 border-sky/30 px-1.5">{r.leave}d</Chip>
                        )}
                        {r.permissions > 0 && (
                          <Chip className="text-orchid bg-orchid/10 border-orchid/30 px-1.5">
                            <KIND_META.permission.Icon className="w-3 h-3" /> {r.permissions}
                          </Chip>
                        )}
                        {r.observations > 0 && (
                          <Chip className="text-sage bg-sage/10 border-sage/30 px-1.5">
                            <KIND_META.observation.Icon className="w-3 h-3" /> {r.observations}
                          </Chip>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* task movement */}
              <section className={`${panelCls} reveal`} style={{ animationDelay: "250ms" }}>
                <h2 className="font-display font-semibold text-lg px-4 sm:px-5 pt-4 pb-2">{t("act.taskMove")}</h2>
                <div className="px-2.5 sm:px-3.5 pb-4 space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mint px-2 mb-1">
                      {t("act.doneIn")} · {agg.completed.length}
                    </p>
                    {agg.completed.length === 0 && (
                      <p className="text-xs text-dim px-2 py-1.5">{t("act.noneDone")}</p>
                    )}
                    {agg.completed.map((x) => {
                      const team = state.teams.find((tm) => tm.id === x.teamId);
                      return (
                        <div key={x.id} className="flex items-center gap-2 px-2 py-1.5">
                          <IconCheck className="w-3.5 h-3.5 text-mint shrink-0" />
                          <span className="flex-1 text-[13px] truncate">{x.title}</span>
                          <span className="font-mono text-[10px] text-dim shrink-0">
                            {x.completedAt ? fmtDate(x.completedAt) : ""}
                          </span>
                          {team && <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_COLORS[team.color].dot}`} />}
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky px-2 mb-1">
                      {t("act.assignedIn")} · {agg.assigned.length}
                    </p>
                    {agg.assigned.length === 0 && (
                      <p className="text-xs text-dim px-2 py-1.5">{t("act.noneAssigned")}</p>
                    )}
                    {agg.assigned.map((x) => {
                      const team = state.teams.find((tm) => tm.id === x.teamId);
                      return (
                        <div key={x.id} className="flex items-center gap-2 px-2 py-1.5">
                          <IconCalendar className="w-3.5 h-3.5 text-sky shrink-0" />
                          <span className="flex-1 text-[13px] truncate">{x.title}</span>
                          <span className="font-mono text-[10px] text-dim shrink-0">{fmtDate(x.dueDate)}</span>
                          {team && <span className={`w-2 h-2 rounded-full shrink-0 ${TEAM_COLORS[team.color].dot}`} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
