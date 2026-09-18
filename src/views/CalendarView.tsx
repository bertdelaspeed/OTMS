import { useMemo, useState } from "react";
import type { AppState, PersonEvent, Task } from "../types";
import { involvedIds, personStatus, useStore } from "../store";
import { KIND_META, RANGE_KINDS, STATUS_META, TEAM_COLORS } from "../meta";
import {
  addDays,
  addMonthsISO,
  dayNum,
  dueLabel,
  fmtDate,
  fmtDateFull,
  monthGridISO,
  monthOfISO,
  monthTitle,
  sameMonthISO,
  startOfWeekISO,
  todayISO,
  weekNumber,
  weekdayShort,
} from "../dates";
import { Avatar, Chip, Segmented, btnGhost, btnIcon, panelCls } from "../ui";
import { IconCalendar, IconCheck, IconChevronLeft, IconChevronRight, IconListChecks, IconPlus } from "../icons";
import { EventModal, TaskModal } from "../modals";
import { useI18n } from "../i18n";
import type { ViewKey } from "../types";

type Mode = "week" | "month" | "year";

interface DayItems {
  tasks: Task[];
  completed: Task[];
  ranges: PersonEvent[];
  marks: PersonEvent[];
}

function itemsForDay(state: AppState, day: string): DayItems {
  const tasks = state.tasks
    .filter((t) => t.status !== "done" && t.startDate <= day && day <= t.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const completed = state.tasks
    .filter((t) => t.status === "done" && t.completedAt === day)
    .sort((a, b) => a.title.localeCompare(b.title));
  const ranges = state.events.filter(
    (e) => RANGE_KINDS.includes(e.kind) && e.date <= day && (e.endDate ?? e.date) >= day
  );
  const marks = state.events.filter((e) => e.date === day && !RANGE_KINDS.includes(e.kind));
  return { tasks, completed, ranges, marks };
}

export function CalendarView({
  onOpenPerson,
  onNavigate,
}: {
  onOpenPerson: (id: string) => void;
  onNavigate: (v: ViewKey) => void;
}) {
  const { state } = useStore();
  const { t } = useI18n();
  const today = todayISO();

  const [mode, setMode] = useState<Mode>("week");
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState<string>(today);
  const [eventFor, setEventFor] = useState<string | null>(null); // day, or null
  const [taskFor, setTaskFor] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    const start = startOfWeekISO(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const monthDays = useMemo(() => {
    const { year, month0 } = monthOfISO(cursor);
    return monthGridISO(year, month0);
  }, [cursor]);

  const yearMonths = useMemo(() => {
    const y = monthOfISO(cursor).year;
    return Array.from({ length: 12 }, (_, m) => ({
      month0: m,
      year: y,
      days: monthGridISO(y, m),
    }));
  }, [cursor]);

  const items = useMemo(() => {
    const map = new Map<string, DayItems>();
    const get = (d: string) => {
      if (!map.has(d)) map.set(d, itemsForDay(state, d));
      return map.get(d)!;
    };
    return get;
  }, [state]);

  /* tasks covering today + who is out today (always visible strip) */
  const todayTasks = useMemo(() => {
    const rank = (t: Task) => (t.status === "active" ? 0 : 1);
    return state.tasks
      .filter((t) => t.status !== "done" && t.startDate <= today && today <= t.dueDate)
      .sort((a, b) => rank(a) - rank(b) || a.dueDate.localeCompare(b.dueDate));
  }, [state.tasks, today]);

  const outToday = useMemo(() => {
    const c: Record<"absent" | "sick" | "leave", number> = { absent: 0, sick: 0, leave: 0 };
    state.people.forEach((p) => {
      const k = personStatus(state, p.id).key;
      if (k === "absent" || k === "sick" || k === "leave") c[k] += 1;
    });
    return c;
  }, [state]);
  const outTotal = outToday.absent + outToday.sick + outToday.leave;

  const navigate = (dir: -1 | 1) => {
    if (mode === "week") setCursor(addDays(cursor, dir * 7));
    else if (mode === "month") setCursor(addMonthsISO(cursor, dir));
    else setCursor(addMonthsISO(cursor, dir * 12));
  };

  const goToday = () => {
    setCursor(today);
    setSelected(today);
  };

  const periodLabel =
    mode === "week"
      ? `${t("cal.weekN", { n: weekNumber(cursor) })} · ${fmtDate(weekDays[0])} – ${fmtDate(weekDays[6])}`
      : mode === "month"
      ? monthTitle(cursor)
      : `${monthOfISO(cursor).year}`;

  const sel = selected ? items(selected) : null;
  const selPerson = (id: string) => state.people.find((p) => p.id === id);

  return (
    <div className="space-y-4">
      <header className="reveal flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-none">{t("cal.title")}</h1>
          <p className="text-mut text-sm mt-2 max-w-xl">{t("cal.sub")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: "week", label: t("cal.week") },
              { value: "month", label: t("cal.month") },
              { value: "year", label: t("cal.year") },
            ]}
          />
          <div className="inline-flex items-center gap-1">
            <button className={btnIcon} onClick={() => navigate(-1)} aria-label="←">
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                cursor === today || sameMonthISO(cursor, today)
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

      {/* -------- today strip (always on top of week/month/year) -------- */}
      <section className={`${panelCls} reveal overflow-hidden`} style={{ animationDelay: "70ms" }}>
        <div className="flex flex-col lg:flex-row">
          <div className="flex items-center gap-4 px-5 py-4 lg:w-[210px] lg:shrink-0 lg:border-r border-b lg:border-b-0 border-line">
            <span className="font-display font-bold text-[46px] leading-none text-mint tabular-nums">
              {dayNum(today)}
            </span>
            <span className="min-w-0">
              <span className="block font-display font-semibold text-[13px] leading-snug">
                {fmtDateFull(today)}
              </span>
              <span className="block font-mono text-[9.5px] text-dim mt-1 uppercase tracking-[0.18em]">
                {t("cal.weekN", { n: weekNumber(today) })}
              </span>
            </span>
          </div>

          <div className="flex-1 min-w-0 px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut">
                {t("cal.todaySchedule")}
              </p>
              {outTotal > 0 && (
                <span className="flex flex-wrap items-center gap-1.5">
                  {(["absent", "sick", "leave"] as const)
                    .filter((k) => outToday[k] > 0)
                    .map((k) => (
                      <Chip key={k} className={STATUS_META[k].chip}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[k].dot}`} />
                        {outToday[k]} {t(STATUS_META[k].key)}
                      </Chip>
                    ))}
                </span>
              )}
            </div>

            {todayTasks.length === 0 ? (
              <p className="text-sm text-dim px-1 pb-1.5">{t("cal.todayEmpty")}</p>
            ) : (
              <div className="flex gap-2.5 overflow-x-auto pb-1.5">
                {todayTasks.map((task) => {
                  const team = state.teams.find((x) => x.id === task.teamId);
                  const color = team ? TEAM_COLORS[team.color] : null;
                  const ids = involvedIds(state, task);
                  const due = dueLabel(task.dueDate);
                  const dueToneCls =
                    due.tone === "late"
                      ? "text-coral"
                      : due.tone === "today"
                      ? "text-amber"
                      : due.tone === "soon"
                      ? "text-sky"
                      : "text-mut";
                  return (
                    <div
                      key={task.id}
                      className="min-w-[250px] max-w-[300px] shrink-0 rounded-lg border border-line2 bg-panel2/60 overflow-hidden hover:-translate-y-0.5 hover:bg-panel2 transition-all duration-150"
                    >
                      <div className={`h-1 ${color?.bar ?? "bg-line2"}`} />
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold truncate">{task.title}</p>
                          <Chip
                            className={
                              task.status === "active"
                                ? "text-amber bg-amber/10 border-amber/30"
                                : "text-sky bg-sky/10 border-sky/30"
                            }
                          >
                            {task.status === "active" ? t("taskStatus.active") : t("cal.plannedToday")}
                          </Chip>
                        </div>
                        <p className="text-[11px] text-mut mt-1 truncate">
                          {team?.name ?? t("tasks.noTeam")} ·{" "}
                          <span className={`font-medium ${dueToneCls}`}>{due.text}</span>
                        </p>
                        <div className="flex items-center -space-x-1.5 mt-2.5">
                          {ids.slice(0, 5).map((id) => {
                            const p = state.people.find((x) => x.id === id);
                            return p ? (
                              <button
                                key={id}
                                onClick={() => onOpenPerson(id)}
                                title={p.name}
                                className="rounded-full"
                              >
                                <Avatar
                                  name={p.name}
                                  hue={p.hue}
                                  size={22}
                                  className="ring-2 ring-panel hover:scale-110 transition-transform"
                                />
                              </button>
                            ) : null;
                          })}
                          {ids.length > 5 && (
                            <span className="w-[22px] h-[22px] rounded-full bg-panel2 border border-line2 inline-flex items-center justify-center text-[9px] font-mono text-mut ring-2 ring-panel">
                              +{ids.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_330px] gap-4 items-start">
        {/* -------- calendar grid -------- */}
        <section className={`${panelCls} overflow-hidden reveal`} style={{ animationDelay: "90ms" }}>
          {mode === "week" && (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 min-w-[820px]">
                {weekDays.map((d) => {
                  const it = items(d);
                  const isToday = d === today;
                  const isSel = d === selected;
                  return (
                    <button
                      key={d}
                      onClick={() => setSelected(d)}
                      className={`text-left border-r border-line last:border-r-0 px-2 pb-3 transition-colors ${
                        isSel ? "bg-panel2/80" : "hover:bg-panel2/50"
                      } ${isToday ? "bg-mint/[0.045]" : ""}`}
                    >
                      <div className="flex items-center justify-between px-1.5 py-2 border-b border-line mb-2 sticky top-0 bg-panel">
                        <span className={`text-[10.5px] font-mono uppercase ${isToday ? "text-mint" : "text-dim"}`}>
                          {weekdayShort(d)}
                        </span>
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-display font-semibold text-xs ${
                            isToday ? "bg-mint text-[#0b130e]" : "text-mut"
                          }`}
                        >
                          {dayNum(d)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {it.tasks.slice(0, 3).map((task) => {
                          const team = state.teams.find((x) => x.id === task.teamId);
                          const color = team ? TEAM_COLORS[team.color].solid : "#93a897";
                          return (
                            <span
                              key={task.id}
                              title={task.title}
                              className="block border-l-2 rounded-r-md bg-panel2/90 px-1.5 py-1 text-[10.5px] leading-tight font-medium truncate"
                              style={{ borderLeftColor: color }}
                            >
                              {task.title}
                            </span>
                          );
                        })}
                        {it.completed.slice(0, 2).map((task) => {
                          const team = state.teams.find((x) => x.id === task.teamId);
                          const color = team ? TEAM_COLORS[team.color].solid : "#93a897";
                          return (
                            <span
                              key={task.id}
                              title={`${task.title} (${t("taskStatus.done")})`}
                              className="flex items-center gap-1 border-l-2 rounded-r-md bg-mint/10 px-1.5 py-1 text-[10.5px] leading-tight font-medium truncate opacity-70"
                              style={{ borderLeftColor: color }}
                            >
                              <IconCheck className="w-3 h-3 text-mint shrink-0" />
                              <span className="truncate">{task.title}</span>
                            </span>
                          );
                        })}
                        {it.ranges.slice(0, 2).map((e) => {
                          const p = selPerson(e.personId);
                          const m = KIND_META[e.kind];
                          const first = e.date === d;
                          return (
                            <span
                              key={e.id}
                              title={`${p?.name ?? ""} — ${t(m.key)}`}
                              className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] leading-tight ${m.chip}`}
                            >
                              <span className="font-mono font-semibold">
                                {p?.name.split(" ").map((w) => w[0]).slice(0, 2).join("") ?? "?"}
                              </span>
                              {first && <span className="truncate">{e.title}</span>}
                            </span>
                          );
                        })}
                        {it.marks.length > 0 && (
                          <span className="flex items-center gap-1 px-1.5 pt-0.5">
                            {it.marks.slice(0, 5).map((e) => (
                              <span
                                key={e.id}
                                title={`${selPerson(e.personId)?.name ?? ""} — ${e.title}`}
                                className={`w-1.5 h-1.5 rounded-full ${KIND_META[e.kind].dot}`}
                              />
                            ))}
                            {it.marks.length > 5 && (
                              <span className="text-[9px] font-mono text-dim">+{it.marks.length - 5}</span>
                            )}
                          </span>
                        )}
                        {it.tasks.length + it.ranges.length > 5 && (
                          <span className="block px-1.5 text-[9.5px] font-mono text-dim">
                            {t("cal.more", { n: it.tasks.length + it.ranges.length - 5 })}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "month" && (
            <div>
              <div className="grid grid-cols-7 border-b border-line">
                {weekDays.map((d) => (
                  <div key={d} className="px-2 py-2 text-center text-[10.5px] font-mono uppercase text-dim">
                    {weekdayShort(d)}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((d, i) => {
                  const it = items(d);
                  const inMonth = sameMonthISO(d, cursor);
                  const isToday = d === today;
                  const isSel = d === selected;
                  const total = it.tasks.length + it.ranges.length + it.marks.length;
                  return (
                    <button
                      key={d}
                      onClick={() => setSelected(d)}
                      className={`min-h-[92px] text-left border-r border-b border-line px-1.5 py-1.5 transition-colors ${
                        i % 7 === 6 ? "border-r-0" : ""
                      } ${i >= 35 ? "border-b-0" : ""} ${isSel ? "bg-panel2/80" : "hover:bg-panel2/50"} ${
                        !inMonth ? "opacity-40" : ""
                      } ${isToday ? "bg-mint/[0.05]" : ""}`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-display font-semibold text-xs mb-1 ${
                          isToday ? "bg-mint text-[#0b130e]" : "text-mut"
                        }`}
                      >
                        {dayNum(d)}
                      </span>
                      <div className="space-y-0.5">
                        {it.tasks.slice(0, 2).map((task) => {
                          const team = state.teams.find((x) => x.id === task.teamId);
                          const color = team ? TEAM_COLORS[team.color].solid : "#93a897";
                          return (
                            <span
                              key={task.id}
                              title={task.title}
                              className="block border-l-2 rounded-r bg-panel2/90 px-1 py-0.5 text-[9.5px] leading-tight truncate"
                              style={{ borderLeftColor: color }}
                            >
                              {task.title}
                            </span>
                          );
                        })}
                        {it.completed.slice(0, 1).map((task) => {
                          const team = state.teams.find((x) => x.id === task.teamId);
                          const color = team ? TEAM_COLORS[team.color].solid : "#93a897";
                          return (
                            <span
                              key={task.id}
                              title={`${task.title} (${t("taskStatus.done")})`}
                              className="flex items-center gap-1 border-l-2 rounded-r bg-mint/10 px-1 py-0.5 text-[9.5px] leading-tight truncate opacity-70"
                              style={{ borderLeftColor: color }}
                            >
                              <IconCheck className="w-2.5 h-2.5 text-mint shrink-0" />
                              <span className="truncate">{task.title}</span>
                            </span>
                          );
                        })}
                        {it.ranges.slice(0, 1).map((e) => {
                          const p = selPerson(e.personId);
                          const m = KIND_META[e.kind];
                          return (
                            <span
                              key={e.id}
                              title={`${p?.name ?? ""} — ${t(m.key)}: ${e.title}`}
                              className={`flex items-center gap-1 rounded border px-1 py-0.5 text-[9.5px] leading-tight truncate ${m.chip}`}
                            >
                              <span className={`w-1 h-1 rounded-full shrink-0 ${m.dot}`} />
                              <span className="truncate">
                                {p?.name.split(" ")[0]} · {t(m.key)}
                              </span>
                            </span>
                          );
                        })}
                        {it.marks.length > 0 && (
                          <span className="flex items-center gap-0.5 px-1">
                            {it.marks.slice(0, 6).map((e) => (
                              <span
                                key={e.id}
                                title={`${selPerson(e.personId)?.name ?? ""} — ${e.title}`}
                                className={`w-1.5 h-1.5 rounded-full ${KIND_META[e.kind].dot}`}
                              />
                            ))}
                          </span>
                        )}
                        {total > 3 && (
                          <span className="block px-1 text-[9px] font-mono text-dim">
                            {t("cal.more", { n: total - 3 })}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "year" && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-px bg-line">
              {yearMonths.map(({ month0, year, days }) => {
                const first = days.find((d) => sameMonthISO(d, `${year}-${`${month0 + 1}`.padStart(2, "0")}-01`))!;
                return (
                  <button
                    key={month0}
                    onClick={() => {
                      setCursor(first);
                      setMode("month");
                    }}
                    className="bg-panel p-3 text-left hover:bg-panel2/60 transition-colors"
                  >
                    <p className={`font-display font-semibold text-sm mb-2 ${sameMonthISO(first, today) ? "text-mint" : ""}`}>
                      {monthTitle(first)}
                    </p>
                    <div className="grid grid-cols-7 gap-[3px]">
                      {days.map((d) => {
                        const it = items(d);
                        const inMonth = sameMonthISO(d, first);
                        const dot = !inMonth
                          ? "bg-transparent"
                          : it.completed.length > 0
                          ? "bg-mint"
                          : it.ranges.length > 0
                          ? `${KIND_META[it.ranges[0].kind].dot} opacity-80`
                          : it.tasks.length > 0
                          ? "bg-mint/70"
                          : it.marks.length > 0
                          ? "bg-sky/60"
                          : "bg-line";
                        return (
                          <span
                            key={d}
                            className={`h-[7px] rounded-[2px] ${dot} ${d === today ? "ring-1 ring-mint" : ""}`}
                          />
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* -------- day detail -------- */}
        <aside className={`${panelCls} p-4 sm:p-5 reveal lg:sticky lg:top-[72px]`} style={{ animationDelay: "140ms" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mut">{t("cal.selected")}</p>
          <h2 className="font-display font-semibold text-lg leading-snug mt-1">
            {selected ? fmtDateFull(selected) : t("cal.pick")}
          </h2>

          {!sel ? (
            <p className="text-sm text-dim mt-3">{t("cal.pick")}</p>
          ) : sel.tasks.length + sel.completed.length + sel.ranges.length + sel.marks.length === 0 ? (
            <p className="text-sm text-dim mt-3">{t("cal.nothing")}</p>
          ) : (
            <div className="mt-3 space-y-4">
              {sel.tasks.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-[0.12em] text-dim mb-1.5">
                    <IconListChecks className="w-3.5 h-3.5" /> {t("cal.tasks")} · {sel.tasks.length}
                  </p>
                  <div className="space-y-1.5">
                    {sel.tasks.map((task) => {
                      const team = state.teams.find((x) => x.id === task.teamId);
                      const color = team ? TEAM_COLORS[team.color].solid : "#93a897";
                      return (
                        <button
                          key={task.id}
                          onClick={() => onNavigate("tasks")}
                          className="w-full text-left border-l-2 rounded-r-lg bg-panel2/80 hover:bg-raise px-2.5 py-2 transition-colors"
                          style={{ borderLeftColor: color }}
                        >
                          <span className="block text-xs font-semibold leading-tight">{task.title}</span>
                          <span className="block text-[10.5px] text-mut mt-0.5 font-mono">
                            {fmtDate(task.startDate)} → {fmtDate(task.dueDate)}
                            {team ? ` · ${team.name}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {sel.completed.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-[0.12em] text-mint mb-1.5">
                    <IconCheck className="w-3.5 h-3.5" /> {t("cal.completed")} · {sel.completed.length}
                  </p>
                  <div className="space-y-1.5">
                    {sel.completed.map((task) => {
                      const team = state.teams.find((x) => x.id === task.teamId);
                      const color = team ? TEAM_COLORS[team.color].solid : "#93a897";
                      return (
                        <button
                          key={task.id}
                          onClick={() => onNavigate("tasks")}
                          className="w-full text-left border-l-2 rounded-r-lg bg-mint/5 hover:bg-mint/10 px-2.5 py-2 transition-colors"
                          style={{ borderLeftColor: color }}
                        >
                          <span className="flex items-center gap-1.5">
                            <IconCheck className="w-3 h-3 text-mint shrink-0" />
                            <span className="block text-xs font-semibold leading-tight">{task.title}</span>
                          </span>
                          <span className="block text-[10.5px] text-mut mt-0.5 font-mono ml-[18px]">
                            {fmtDate(task.startDate)} → {fmtDate(task.dueDate)}
                            {team ? ` · ${team.name}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {sel.ranges.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-dim mb-1.5">
                    {t("cal.absences")} · {sel.ranges.length}
                  </p>
                  <div className="space-y-1">
                    {sel.ranges.map((e) => {
                      const p = selPerson(e.personId);
                      const m = KIND_META[e.kind];
                      return (
                        <button
                          key={e.id}
                          onClick={() => p && onOpenPerson(p.id)}
                          className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-panel2/80 text-left transition-colors"
                        >
                          {p && <Avatar name={p.name} hue={p.hue} size={24} />}
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-medium truncate">{p?.name ?? "—"}</span>
                            <span className="block text-[10.5px] text-mut truncate">{e.title}</span>
                          </span>
                          <Chip className={m.chip}>{t(m.key)}</Chip>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {sel.marks.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-dim mb-1.5">
                    {t("cal.events")} · {sel.marks.length}
                  </p>
                  <div className="space-y-1">
                    {sel.marks.map((e) => {
                      const p = selPerson(e.personId);
                      const m = KIND_META[e.kind];
                      return (
                        <button
                          key={e.id}
                          onClick={() => p && onOpenPerson(p.id)}
                          className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-panel2/80 text-left transition-colors"
                        >
                          {p && <Avatar name={p.name} hue={p.hue} size={24} />}
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-medium truncate">{p?.name ?? "—"}</span>
                            <span className="block text-[10.5px] text-mut truncate">{e.title}</span>
                            {e.kind === "permission" && e.timeFrom && e.timeTo && (
                              <span className="block font-mono text-[10px] text-orchid">
                                {e.timeFrom} – {e.timeTo}
                              </span>
                            )}
                          </span>
                          <Chip className={m.chip}>
                            <m.Icon className="w-3 h-3" /> {t(m.key)}
                          </Chip>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {selected && (
            <div className="flex gap-2 mt-5 pt-4 border-t border-line">
              <button className={`${btnGhost} flex-1 justify-center text-xs`} onClick={() => setEventFor(selected)}>
                <IconPlus className="w-3.5 h-3.5" /> {t("cal.logEvent")}
              </button>
              <button className={`${btnGhost} flex-1 justify-center text-xs`} onClick={() => setTaskFor(selected)}>
                <IconCalendar className="w-3.5 h-3.5" /> {t("cal.newTask")}
              </button>
            </div>
          )}
        </aside>
      </div>

      <EventModal
        open={eventFor !== null}
        personId={null}
        prefillDate={eventFor}
        onClose={() => setEventFor(null)}
      />
      <TaskModal
        open={taskFor !== null}
        task={null}
        prefill={taskFor ? { start: taskFor, due: taskFor } : null}
        onClose={() => setTaskFor(null)}
      />
    </div>
  );
}
