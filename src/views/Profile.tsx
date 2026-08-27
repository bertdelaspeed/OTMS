import { useMemo, useState } from "react";
import type { EventKind } from "../types";
import { personStatus, tasksFor, teamsOf, useStore } from "../store";
import { KIND_META, STATUS_META } from "../meta";
import { exportPersonPdf } from "../exports";
import { daysBetween, dueLabel, fmtDate, fmtDateFull, fmtDateYear, fmtTimeRange, relTime, spanDays, todayISO, windowHours } from "../dates";
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
  IconFileText,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
} from "../icons";
import { EventModal, PersonModal } from "../modals";
import { useI18n } from "../i18n";

const DUE_TONE_CLS: Record<string, string> = {
  late: "text-coral bg-coral/10 border-coral/30",
  today: "text-amber bg-amber/10 border-amber/30",
  soon: "text-sky bg-sky/10 border-sky/30",
  later: "text-mut bg-panel2 border-line2",
};

const KIND_STAT_KEY: Record<EventKind, string> = {
  commendation: "profile.k.commendation",
  misconduct: "profile.k.misconduct",
  absence: "profile.k.absence",
  sick: "profile.k.sick",
  leave: "profile.k.leave",
  permission: "profile.k.permission",
  task: "profile.k.task",
  observation: "profile.k.observation",
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
  const { t, tp, lang } = useI18n();
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

  const kindStats = (Object.keys(KIND_STAT_KEY) as EventKind[]).map((k) => {
    const list = events.filter((e) => e.kind === k);
    const isRange = k === "absence" || k === "sick" || k === "leave";
    const isHours = k === "permission";
    const days = list.reduce((n, e) => n + spanDays(e.date, e.endDate), 0);
    const hours = Math.round(list.reduce((n, e) => n + windowHours(e.timeFrom, e.timeTo), 0) * 10) / 10;
    return { k, n: list.length, days, hours, ranged: isRange, isHours };
  });

  const presentKinds = kindStats.filter((s) => s.n > 0).map((s) => s.k);
  const visible = events.filter((e) => filter === "all" || e.kind === filter);

  const removeEvent = (id: string, title: string) => {
    dispatch({ type: "REMOVE_EVENT", id });
    push(t("profile.removedEntry", { title }), "warn");
  };

  const removePerson = () => {
    dispatch({ type: "REMOVE_PERSON", id: person.id });
    push(t("people.removed", { name: person.name }), "warn");
    onDeleted();
  };

  const downloadPdf = () => {
    void exportPersonPdf({
      person,
      status: status.key,
      statusLabel: t(STATUS_META[status.key].key),
      teamNames: teams.map((tm) => tm.name),
      joinedText: fmtDateYear(person.joinedAt),
      tenureText: tp("profile.tenure", tenure),
      summary: kindStats.map((s) => ({
        label: t(`profile.k.${s.k}`),
        entries: s.n,
        days: s.ranged ? s.days : null,
      })),
      events: [...events].reverse().map((e) => ({
        date:
          (e.endDate ? `${fmtDate(e.date)} → ${fmtDate(e.endDate)}` : fmtDate(e.date)) +
          (e.kind === "permission" && e.timeFrom && e.timeTo ? ` · ${fmtTimeRange(e.timeFrom, e.timeTo)}` : ""),
        kind: e.kind,
        typeLabel: t(KIND_META[e.kind].key),
        title: e.title,
        note: e.note,
      })),
      labels: {
        brand: t("app.name"),
        title: t("pdf.title"),
        generated: fmtDateFull(todayISO()),
        contact: t("pdf.contact"),
        position: t("pdf.position"),
        history: t("pdf.history"),
        matricule: t("mp.matricule"),
        role: t("pdf.role"),
        teams: t("pdf.teams"),
        joined: t("profile.joined"),
        tenure: t("profile.tenure", { n: tenure }),
        email: t("mp.email"),
        phone: t("mp.phone"),
        none: t("pdf.none"),
        summary: t("pdf.summary"),
        events: t("pdf.events"),
        category: t("pdf.category"),
        entries: t("pdf.entries"),
        days: t("pdf.days"),
        date: t("pdf.date"),
        type: t("pdf.type"),
        description: t("pdf.description"),
        note: t("pdf.note"),
        page: (a, b) => t("pdf.page", { a, b }),
      },
    }).then(() => push(t("profile.pdfSaved")));
  };

  const statusHint =
    status.key === "available"
      ? t("profile.hintFree")
      : status.key === "on-task"
      ? t("profile.hintTask", { x: status.detail })
      : status.detail;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="reveal inline-flex items-center gap-2 text-sm text-mut hover:text-ink transition-colors"
      >
        <IconArrowLeft className="w-4 h-4" /> {t("profile.back")}
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
              {person.matricule && (
                <Chip className="text-mut bg-panel2 border-line2 font-mono tracking-wide">
                  {person.matricule}
                </Chip>
              )}
            </div>
            <p className="text-mut text-sm mt-2">
              {person.role}
              {teams.length > 0 && (
                <>
                  {" · "}
                  {teams.map((tm) => tm.name).join(", ")}
                </>
              )}
            </p>
            <p className="text-xs text-dim mt-1">{statusHint}</p>
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
                <IconCalendar className="w-3.5 h-3.5 text-dim" /> {t("profile.joined")}{" "}
                {fmtDateYear(person.joinedAt)} ·{" "}
                <span className="font-mono text-[10.5px]">{t("profile.tenure", { n: tenure })}</span>
              </span>
            </div>
          </div>
          <div className="flex sm:flex-col gap-2 shrink-0">
            <button className={btnPrimary} onClick={() => setEventOpen(true)}>
              <IconPlus className="w-4 h-4" /> {t("profile.logEvent")}
            </button>
            <button className={btnGhost} onClick={() => setEditOpen(true)}>
              <IconPencil className="w-4 h-4" /> {t("profile.edit")}
            </button>
            <button className={btnGhost} onClick={downloadPdf}>
              <IconFileText className="w-4 h-4" /> {t("profile.pdf")}
            </button>
            <DangerAction onConfirm={removePerson} label={t("profile.remove", { name: person.name })} />
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
                {s.isHours ? s.hours : s.ranged ? s.days : s.n}
                {s.isHours ? (
                  <span className="text-xs text-mut font-body font-normal">h</span>
                ) : (
                  s.ranged && (
                    <span className="text-xs text-mut font-body font-normal">
                      {lang === "fr" ? "j" : "d"}
                    </span>
                  )
                )}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-mut mt-1">
                {t(KIND_STAT_KEY[s.k])}
              </p>
            </div>
          );
        })}
      </section>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Current load */}
        <section className={`${panelCls} reveal`} style={{ animationDelay: "160ms" }}>
          <h2 className="font-display font-semibold text-lg px-4 sm:px-5 pt-4 pb-1">{t("profile.load")}</h2>
          <div className="px-2.5 sm:px-3.5 pb-3">
            {load.length === 0 && (
              <p className="text-sm text-dim px-2 py-5 text-center">{t("profile.loadEmpty")}</p>
            )}
            {load.map((task) => {
              const due = dueLabel(task.dueDate);
              const team = state.teams.find((x) => x.id === task.teamId);
              return (
                <div key={task.id} className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-panel2/70 transition-colors">
                  <IconBriefcase
                    className={`w-4 h-4 shrink-0 ${task.status === "active" ? "text-amber" : "text-sky"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{task.title}</p>
                    <p className="text-[11px] text-mut truncate">
                      {team?.name ?? t("profile.individual")} ·{" "}
                      <span className="font-mono">
                        {fmtDate(task.startDate)} → {fmtDate(task.dueDate)}
                      </span>
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
              <h2 className="font-display font-semibold text-lg">{t("profile.record")}</h2>
              <p className="text-xs text-mut mt-0.5">{tp("profile.entry", events.length)}</p>
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
                  {f === "all" ? t("profile.everything") : t(KIND_META[f as EventKind].key)}
                  <span className="font-mono text-[10px] text-dim">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="px-4 sm:px-6 pb-5 pt-1">
            {visible.length === 0 && (
              <EmptyState
                icon={<IconCalendar className="w-5 h-5" />}
                title={t("profile.emptyTitle")}
                body={t("profile.emptyBody")}
                action={
                  <button className={btnPrimary} onClick={() => setEventOpen(true)}>
                    <IconPlus className="w-4 h-4" /> {t("profile.emptyAction")}
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
                        <Chip className={m.chip}>{t(m.key)}</Chip>
                        <span className="font-mono text-[10.5px] text-dim">
                          {fmtDate(e.date)}
                          {e.endDate ? ` → ${fmtDate(e.endDate)}` : ""}
                          {e.kind === "permission" && e.timeFrom && e.timeTo
                            ? ` · ${fmtTimeRange(e.timeFrom, e.timeTo)}`
                            : ""}{" "}
                          · {t("profile.logged", { t: relTime(e.createdAt) })}
                        </span>
                      </div>
                    </div>
                    <span className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                      <DangerAction onConfirm={() => removeEvent(e.id, e.title)} label={t("profile.removeEntry")} />
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
