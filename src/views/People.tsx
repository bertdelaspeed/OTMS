import { useMemo, useState } from "react";
import type { Person, StatusKey } from "../types";
import { activeTasksFor, personLastEvent, personStatus, teamsOf, useStore } from "../store";
import { STATUS_META, STATUS_ORDER, TEAM_COLORS, KIND_META } from "../meta";
import { fmtDate } from "../dates";
import { Avatar, Chip, DangerAction, EmptyState, StatusPill, StatusSegments, TextInput, btnGhost, btnIcon, btnPrimary, panelCls, useToast } from "../ui";
import { IconBriefcase, IconChevronRight, IconDownload, IconPencil, IconSearch, IconUpload, IconUserPlus, IconUsers } from "../icons";
import { ImportExcelModal, PersonModal } from "../modals";
import { exportPeopleExcel } from "../exports";
import { useI18n } from "../i18n";

type Filter = StatusKey | "all";

/* Shared column grid: person | status | teams | (lg) current task | last record | actions */
const GRID_MD =
  "md:grid-cols-[minmax(220px,1.5fr)_120px_minmax(170px,1.1fr)_minmax(180px,1fr)_auto]";
const GRID_LG =
  "lg:grid-cols-[minmax(240px,1.4fr)_124px_minmax(180px,1fr)_minmax(210px,1.25fr)_minmax(180px,1fr)_auto]";
const colHead =
  "text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-dim";

export function People({ onOpenPerson }: { onOpenPerson: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const { t, tp } = useI18n();
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<{ person: Person | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
    const c: Record<string, number> = { all: rows.length, available: 0, "on-task": 0, "on-mission": 0, errand: 0, absent: 0, sick: 0, leave: 0 };
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
    push(t("people.removed", { name: p.name }), "warn");
  };

  const setTaskStatus = (taskId: string, status: "todo" | "active" | "done") => {
    dispatch({ type: "SET_TASK_STATUS", id: taskId, status });
  };

  return (
    <div className="space-y-4">
      <header className="reveal flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-none">{t("people.title")}</h1>
          <p className="text-mut text-sm mt-2">{tp("people.sub", state.people.length)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={btnGhost}
            onClick={() => {
              void exportPeopleExcel(state).then(() => push(t("people.exported")));
            }}
          >
            <IconDownload className="w-4 h-4" /> {t("people.export")}
          </button>
          <button className={btnGhost} onClick={() => setImportOpen(true)}>
            <IconUpload className="w-4 h-4" /> {t("people.import")}
          </button>
          <button className={btnPrimary} onClick={() => setModal({ person: null })}>
            <IconUserPlus className="w-4 h-4" /> {t("people.add")}
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="reveal flex flex-wrap items-center gap-2.5" style={{ animationDelay: "70ms" }}>
        <div className="relative w-full sm:w-64">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <TextInput
            className="pl-9"
            placeholder={t("people.searchPh")}
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
                {f === "all" ? t("people.everyone") : t(STATUS_META[f as StatusKey].key)}
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
            title={t("people.emptyTitle")}
            body={t("people.emptyBody")}
            action={
              <button className={btnPrimary} onClick={() => setModal({ person: null })}>
                <IconUserPlus className="w-4 h-4" /> {t("people.emptyAction")}
              </button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className={panelCls}>
          <EmptyState
            icon={<IconSearch className="w-5 h-5" />}
            title={t("people.noMatchTitle")}
            body={t("people.noMatchBody")}
          />
        </div>
      ) : (
        <div className={`${panelCls} divide-y divide-line overflow-hidden`}>
          {/* Column headers */}
          <div
            className={`hidden md:grid items-center gap-3 px-3.5 sm:px-4 py-2.5 border-b border-line2 bg-panel2/40 ${GRID_MD} ${GRID_LG}`}
          >
            <span className={colHead}>{t("people.col.person")}</span>
            <span className={colHead}>{t("people.col.status")}</span>
            <span className={colHead}>{t("people.col.teams")}</span>
            <span className={`hidden lg:block ${colHead}`}>{t("people.col.task")}</span>
            <span className={colHead}>{t("people.col.last")}</span>
            <span aria-hidden />
          </div>

          {visible.map((r, i) => (
            <div
              key={r.p.id}
              onClick={() => onOpenPerson(r.p.id)}
              className={`reveal group flex items-center gap-3 px-3.5 sm:px-4 py-3 hover:bg-panel2/60 cursor-pointer transition-colors md:grid md:items-center ${GRID_MD} ${GRID_LG}`}
              style={{ animationDelay: `${Math.min(i * 40, 360)}ms` }}
            >
              {/* Person — name wraps, never truncates */}
              <div className="flex items-center gap-3 flex-1 min-w-0 md:flex-none md:min-w-0">
                <Avatar name={r.p.name} hue={r.p.hue} size={38} className="shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-snug break-words">
                    {r.p.name}
                    {r.p.matricule && (
                      <span className="ml-2 align-middle inline-block rounded border border-line2 bg-panel2/70 px-1.5 py-px font-mono text-[9.5px] font-normal tracking-wide text-mut">
                        {r.p.matricule}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-mut leading-snug break-words mt-0.5">{r.p.role}</p>
                </div>
              </div>

              <div className="w-[112px] shrink-0 md:w-auto">
                <StatusPill status={r.s.key} pulse />
              </div>

              <div className="hidden md:flex items-center gap-1.5 flex-wrap min-w-0">
                {r.teams.length === 0 && <span className="text-xs text-dim">{t("people.noTeam")}</span>}
                {r.teams.slice(0, 2).map((tm) => (
                  <Chip key={tm.id} className={TEAM_COLORS[tm.color].chip}>
                    <span className={`w-1.5 h-1.5 rounded-full ${TEAM_COLORS[tm.color].dot}`} />
                    {tm.name}
                  </Chip>
                ))}
                {r.teams.length > 2 && (
                  <span className="font-mono text-[10px] text-dim">+{r.teams.length - 2}</span>
                )}
              </div>

              <div className="hidden lg:flex flex-col gap-1.5 min-w-0 text-xs">
                {r.load.length === 0 ? (
                  <span className="text-dim">{t("people.noActive")}</span>
                ) : (
                  <>
                    <div className="flex items-start gap-1.5">
                      <IconBriefcase className="w-3.5 h-3.5 text-amber shrink-0 mt-px" />
                      <span
                        className="text-mut leading-snug line-clamp-2 break-words"
                        title={r.load.map((x) => x.title).join(", ")}
                      >
                        {r.load[0].title}
                        {r.load.length > 1 && ` +${r.load.length - 1}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <StatusSegments
                        value={r.load[0].status}
                        onChange={(s) => setTaskStatus(r.load[0].id, s)}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-1.5 w-36 md:w-auto min-w-0 text-xs text-mut">
                {r.last ? (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_META[r.last.kind].dot}`} />
                    <span className="font-mono text-[10.5px] shrink-0">{fmtDate(r.last.date)}</span>
                    <span className="truncate" title={r.last.title}>
                      {t(KIND_META[r.last.kind].key)}
                    </span>
                  </>
                ) : (
                  <span className="text-dim">{t("people.noRecord")}</span>
                )}
              </div>

              <div
                className="flex items-center gap-1.5 shrink-0 justify-self-end"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className={`${btnIcon} hover:text-amber`}
                  title={t("common.edit")}
                  onClick={() => setModal({ person: r.p })}
                >
                  <IconPencil className="w-4 h-4" />
                </button>
                <DangerAction onConfirm={() => remove(r.p)} label={t("profile.remove", { name: r.p.name })} />
                <IconChevronRight className="hidden sm:block w-4 h-4 text-dim group-hover:text-mut transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      <PersonModal open={modal !== null} person={modal?.person ?? null} onClose={() => setModal(null)} />
      <ImportExcelModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
