import { useEffect, useMemo, useState } from "react";
import type { EventKind, Person, Task, TaskStatus, Team, TeamColor } from "./types";
import { involvedIds, makeEvent, useStore } from "./store";
import { uid } from "./data";
import { todayISO } from "./dates";
import { KIND_META, KIND_ORDER, TASK_STATUS_KEY, TEAM_COLORS, TEAM_COLOR_KEYS } from "./meta";
import { Field, Modal, Select, TextArea, TextInput, btnGhost, btnPrimary, useToast } from "./ui";
import { useI18n } from "./i18n";
import { Avatar, Chip } from "./ui";
import { IconCheck, IconDownload, IconSearch, IconSheet, IconUpload } from "./icons";
import { downloadPeopleTemplate, parsePeopleExcel } from "./exports";
import type { ImportWarning, ParsedRow } from "./exports";

const HUES = [16, 40, 70, 96, 130, 158, 188, 210, 232, 258, 288, 316, 340];

/* ================= Person ================= */

export function PersonModal({
  open,
  person,
  onClose,
}: {
  open: boolean;
  person: Person | null;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const { push } = useToast();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [joined, setJoined] = useState(todayISO());
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(person?.name ?? "");
    setRole(person?.role ?? "");
    setEmail(person?.email ?? "");
    setPhone(person?.phone ?? "");
    setJoined(person?.joinedAt ?? todayISO());
    setTeamIds(person ? state.teams.filter((tm) => tm.memberIds.includes(person.id)).map((tm) => tm.id) : []);
    setErr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, person]);

  const submit = () => {
    if (!name.trim()) return setErr(t("mp.nameRequired"));
    const clean = {
      name: name.trim(),
      role: role.trim(),
      email: email.trim(),
      phone: phone.trim(),
      joinedAt: joined || todayISO(),
    };
    if (person) {
      dispatch({ type: "UPDATE_PERSON", person: { ...person, ...clean }, teamIds });
      push(t("mp.updated"));
    } else {
      const p: Person = {
        id: uid(),
        ...clean,
        hue: HUES[Math.floor(Math.random() * HUES.length)],
      };
      dispatch({ type: "ADD_PERSON", person: p, teamIds });
      push(t("mp.added", { name: p.name }));
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={person ? t("mp.editTitle") : t("mp.title")}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>{t("common.cancel")}</button>
          <button className={btnPrimary} onClick={submit}>
            {person ? t("common.save") : t("common.create")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("mp.name")} error={err}>
          <TextInput autoFocus value={name} placeholder={t("mp.namePh")} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("mp.role")}>
          <TextInput value={role} placeholder={t("mp.rolePh")} onChange={(e) => setRole(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("mp.email")}>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t("mp.phone")}>
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label={t("mp.joined")}>
          <TextInput type="date" value={joined} onChange={(e) => setJoined(e.target.value)} />
        </Field>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mut mb-1.5">
            {t("mp.teams")}
          </p>
          {state.teams.length === 0 ? (
            <p className="text-xs text-dim">{t("mp.noTeams")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {state.teams.map((tm) => {
                const on = teamIds.includes(tm.id);
                const c = TEAM_COLORS[tm.color];
                return (
                  <button
                    key={tm.id}
                    type="button"
                    onClick={() => setTeamIds((ids) => (on ? ids.filter((x) => x !== tm.id) : [...ids, tm.id]))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                      on ? c.chip : "border-line text-mut hover:border-line2 hover:text-ink"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${on ? "" : "opacity-40"}`} />
                    {tm.name}
                    {on && <IconCheck className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ================= Team ================= */

export function TeamModal({
  open,
  team,
  onClose,
}: {
  open: boolean;
  team: Team | null;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const { t } = useI18n();
  const { push } = useToast();

  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [color, setColor] = useState<TeamColor>("mint");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(team?.name ?? "");
    setPurpose(team?.purpose ?? "");
    setColor(team?.color ?? "mint");
    setErr("");
  }, [open, team]);

  const submit = () => {
    if (!name.trim()) return setErr(t("mt.nameRequired"));
    if (team) {
      dispatch({ type: "UPDATE_TEAM", team: { ...team, name: name.trim(), purpose: purpose.trim(), color } });
      push(t("mt.updated"));
    } else {
      dispatch({
        type: "ADD_TEAM",
        team: { id: uid(), name: name.trim(), purpose: purpose.trim(), color, memberIds: [], createdAt: new Date().toISOString() },
      });
      push(t("mt.created", { name: name.trim() }));
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={team ? t("mt.editTitle") : t("mt.title")}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>{t("common.cancel")}</button>
          <button className={btnPrimary} onClick={submit}>
            {team ? t("common.save") : t("common.create")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("mt.name")} error={err}>
          <TextInput autoFocus value={name} placeholder={t("mt.namePh")} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("mt.purpose")}>
          <TextArea rows={2} value={purpose} placeholder={t("mt.purposePh")} onChange={(e) => setPurpose(e.target.value)} />
        </Field>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mut mb-1.5">{t("mt.color")}</p>
          <div className="flex flex-wrap gap-2">
            {TEAM_COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                title={t(TEAM_COLORS[c].key)}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full ${TEAM_COLORS[c].swatch} transition-all duration-150 ${
                  color === c ? "ring-2 ring-offset-2 ring-offset-panel ring-ink scale-110" : "opacity-70 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ================= Members ================= */

export function MembersModal({
  open,
  team,
  onClose,
}: {
  open: boolean;
  team: Team | null;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const { t, tp } = useI18n();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open, team]);

  if (!team) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const selected = state.teams.find((x) => x.id === team.id)?.memberIds ?? [];

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    dispatch({ type: "SET_TEAM_MEMBERS", teamId: team.id, memberIds: next });
  };

  const people = state.people.filter((p) =>
    (p.name + " " + p.role).toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("mm.title")}
      subtitle={t("mm.sub", { name: team.name })}
      footer={
        <button className={btnPrimary} onClick={onClose}>
          <IconCheck className="w-4 h-4" /> {t("common.done")} · {tp("mm.selected", selected.length)}
        </button>
      }
    >
      {state.people.length === 0 ? (
        <p className="text-sm text-dim text-center py-6">{t("mm.noPeople")}</p>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <TextInput className="pl-9" placeholder={t("mm.searchPh")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
            {people.length === 0 && <p className="text-sm text-dim text-center py-5">{t("mm.none")}</p>}
            {people.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-150 ${
                    on ? "border-mint/40 bg-mint/[0.07]" : "border-transparent hover:bg-panel2"
                  }`}
                >
                  <Avatar name={p.name} hue={p.hue} size={30} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium leading-tight truncate">{p.name}</span>
                    <span className="block text-[11px] text-mut truncate">{p.role}</span>
                  </span>
                  <span
                    className={`w-5 h-5 rounded-md border inline-flex items-center justify-center shrink-0 transition-all ${
                      on ? "bg-mint border-mint text-[#0b130e]" : "border-line2 text-transparent"
                    }`}
                  >
                    <IconCheck className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ================= Task ================= */

export function TaskModal({
  open,
  task,
  onClose,
  prefill,
}: {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  prefill?: { start: string; due: string } | null;
}) {
  const { state, dispatch } = useStore();
  const { t, tp } = useI18n();
  const { push } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [startDate, setStartDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(todayISO());
  const [err, setErr] = useState("");
  const [dateErr, setDateErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setTeamId(task?.teamId ?? "");
    setAssigneeIds(task?.assigneeIds ?? []);
    setStatus(task?.status ?? "todo");
    setStartDate(task?.startDate ?? prefill?.start ?? todayISO());
    setDueDate(task?.dueDate ?? prefill?.due ?? todayISO());
    setErr("");
    setDateErr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const candidate: Task = {
    id: task?.id ?? "",
    title: title.trim(),
    description: description.trim(),
    teamId: teamId || null,
    assigneeIds,
    status,
    startDate,
    dueDate,
    createdAt: task?.createdAt ?? new Date().toISOString(),
    completedAt: task?.completedAt ?? null,
  };
  const involvedCount = involvedIds(state, candidate).length;

  const submit = () => {
    if (!title.trim()) return setErr(t("mtask.titleRequired"));
    if (dueDate < startDate) return setDateErr(t("mtask.datesInvalid"));
    if (task) {
      dispatch({ type: "UPDATE_TASK", task: { ...candidate, id: task.id }, prev: task });
      push(t("mtask.updated"));
    } else {
      const created: Task = { ...candidate, id: uid() };
      dispatch({ type: "ADD_TASK", task: created });
      push(
        involvedCount > 0
          ? t("mtask.created", { t: created.title, who: tp("mtask.person", involvedCount) })
          : t("mtask.updated")
      );
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={task ? t("mtask.editTitle") : t("mtask.title")}
      footer={
        <>
          {involvedCount > 0 && (
            <span className="mr-auto inline-flex items-center gap-2 text-xs text-mut">
              <span className="flex -space-x-1.5">
                {involvedIds(state, candidate)
                  .slice(0, 4)
                  .map((id) => {
                    const p = state.people.find((x) => x.id === id)!;
                    return <Avatar key={id} name={p.name} hue={p.hue} size={22} className="ring-2 ring-panel" />;
                  })}
              </span>
              {tp("mtask.person", involvedCount)}
            </span>
          )}
          <button className={btnGhost} onClick={onClose}>{t("common.cancel")}</button>
          <button className={btnPrimary} onClick={submit}>
            {task ? t("common.save") : t("common.create")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("mtask.what")} error={err}>
          <TextInput autoFocus value={title} placeholder={t("mtask.whatPh")} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={`${t("mtask.desc")} · ${t("common.optional")}`}>
          <TextArea rows={2} value={description} placeholder={t("mtask.descPh")} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mut mb-1.5">{t("mtask.period")}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("mtask.from")}>
              <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label={t("mtask.to")} error={dateErr}>
              <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
          <p className="text-[11px] text-dim mt-1.5">{t("mtask.periodHint")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("mtask.team")}>
            <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">{t("mtask.noTeam")}</option>
              {state.teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("mtask.status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {(["todo", "active", "done"] as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t(TASK_STATUS_KEY[s])}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mut mb-1.5">
            {t("mtask.individuals")}
          </p>
          <p className="text-[11px] text-dim mb-2">{t("mtask.indHint")}</p>
          <div className="flex flex-wrap gap-1.5">
            {state.people.map((p) => {
              const on = assigneeIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setAssigneeIds((ids) => (on ? ids.filter((x) => x !== p.id) : [...ids, p.id]))
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                    on ? "border-mint/50 bg-mint/10 text-ink" : "border-line text-mut hover:border-line2 hover:text-ink"
                  }`}
                >
                  <Avatar name={p.name} hue={p.hue} size={20} />
                  {p.name.split(" ")[0]}
                  {on && <IconCheck className="w-3 h-3 text-mint" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ================= Event ================= */

export function EventModal({
  open,
  personId,
  onClose,
  prefillDate,
}: {
  open: boolean;
  /** null = let the user pick the person inside the modal */
  personId: string | null;
  onClose: () => void;
  prefillDate?: string | null;
}) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const { push } = useToast();

  const [kind, setKind] = useState<EventKind>("observation");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [timeErr, setTimeErr] = useState("");
  const [picked, setPicked] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind("observation");
    setTitle("");
    setDate(prefillDate ?? todayISO());
    setEndDate("");
    setTimeFrom("");
    setTimeTo("");
    setNote("");
    setErr("");
    setTimeErr("");
    setPicked(state.people[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, personId]);

  const effectiveId = personId ?? picked;
  const person = state.people.find((p) => p.id === effectiveId);
  if (!person) return null;

  const isRange = kind === "absence" || kind === "sick" || kind === "leave";
  const isTime = kind === "permission";

  const submit = () => {
    if (!title.trim()) return setErr(t("mev.required"));
    if (isTime) {
      if (!timeFrom || !timeTo) return setTimeErr(t("mev.timeRequired"));
      if (timeTo <= timeFrom) return setTimeErr(t("mev.timeInvalid"));
    }
    dispatch({
      type: "ADD_EVENT",
      event: makeEvent({
        personId: person.id,
        kind,
        title: title.trim(),
        note: note.trim(),
        date: date || todayISO(),
        endDate: isRange && endDate ? endDate : null,
        timeFrom: isTime ? timeFrom : null,
        timeTo: isTime ? timeTo : null,
        taskId: null,
      }),
    });
    push(t("mev.saved", { name: person.name.split(" ")[0] }));
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("mev.titleFor", { name: person.name })}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>{t("common.cancel")}</button>
          <button className={btnPrimary} onClick={submit}>{t("common.create")}</button>
        </>
      }
    >
      <div className="space-y-4">
        {personId === null && (
          <Field label={t("people.title")}>
            <Select value={picked} onChange={(e) => setPicked(e.target.value)}>
              {state.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.role}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mut mb-1.5">{t("mev.kind")}</p>
          <div className="flex flex-wrap gap-1.5">
            {KIND_ORDER.map((k) => {
              const m = KIND_META[k];
              const on = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                    on ? m.chip : "border-line text-mut hover:border-line2 hover:text-ink"
                  }`}
                >
                  <m.Icon className="w-3.5 h-3.5" />
                  {t(m.key)}
                </button>
              );
            })}
          </div>
        </div>

        <Field label={t("mev.what")} error={err}>
          <TextInput autoFocus value={title} placeholder={t("mev.whatPh")} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        {isTime ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t("mev.date")}>
                <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label={t("mev.timeFrom")} error={timeErr}>
                <TextInput
                  type="time"
                  value={timeFrom}
                  onChange={(e) => {
                    setTimeFrom(e.target.value);
                    setTimeErr("");
                  }}
                />
              </Field>
              <Field label={t("mev.timeTo")}>
                <TextInput
                  type="time"
                  value={timeTo}
                  onChange={(e) => {
                    setTimeTo(e.target.value);
                    setTimeErr("");
                  }}
                />
              </Field>
            </div>
            <p className="text-[11px] text-dim -mt-2">{t("mev.timeHint")}</p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("mev.date")}>
                <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label={`${t("mev.end")} · ${t("common.optional")}`}>
                <TextInput
                  type="date"
                  value={endDate}
                  min={date}
                  disabled={!isRange}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={!isRange ? "opacity-40" : ""}
                />
              </Field>
            </div>
            {isRange && <p className="text-[11px] text-dim -mt-2">{t("mev.endHint")}</p>}
          </>
        )}

        <Field label={`${t("mev.note")} · ${t("common.optional")}`}>
          <TextArea rows={3} value={note} placeholder={t("mev.notePh")} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ================= Excel import ================= */

export function ImportExcelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { t, tp } = useI18n();
  const { push } = useToast();

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileWarnings, setFileWarnings] = useState<ImportWarning[]>([]);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFileName(null);
      setParsing(false);
      setRows(null);
      setFileWarnings([]);
      setMode("add");
      setDragOver(false);
      setError("");
    }
  }, [open]);

  const handleFile = async (file: File) => {
    setParsing(true);
    setError("");
    setRows(null);
    setFileName(file.name);
    try {
      const res = await parsePeopleExcel(file);
      if (res.rows.length === 0) setError(t("import.empty"));
      setRows(res.rows);
      setFileWarnings(res.warnings);
    } catch {
      setError(t("import.badFile"));
      setFileName(null);
    }
    setParsing(false);
  };

  const existingNames = useMemo(
    () => new Set(state.people.map((p) => p.name.toLowerCase())),
    [state.people]
  );
  const teamNamesLower = useMemo(
    () => new Set(state.teams.map((tm) => tm.name.toLowerCase())),
    [state.teams]
  );

  const unknownTeamWarnings: ImportWarning[] = useMemo(
    () =>
      (rows ?? []).flatMap((r) =>
        r.teamNames
          .filter((n) => !teamNamesLower.has(n.toLowerCase()))
          .map((team) => ({ kind: "unknownTeam" as const, row: r.sheetRow, team }))
      ),
    [rows, teamNamesLower]
  );

  const allWarnings = [...fileWarnings, ...unknownTeamWarnings];
  const skippedDupes = (rows ?? []).filter(
    (r) => mode === "add" && existingNames.has(r.name.toLowerCase())
  ).length;
  const importable = (rows ?? []).filter(
    (r) => !(mode === "add" && existingNames.has(r.name.toLowerCase()))
  );

  const run = () => {
    if (importable.length === 0) return;
    if (mode === "replace") {
      state.people.forEach((p) => dispatch({ type: "REMOVE_PERSON", id: p.id }));
    }
    let i = 0;
    importable.forEach((r) => {
      const teamIds = r.teamNames
        .map((n) => state.teams.find((tm) => tm.name.toLowerCase() === n.toLowerCase())?.id)
        .filter((x): x is string => !!x);
      dispatch({
        type: "ADD_PERSON",
        person: {
          id: uid(),
          name: r.name,
          role: r.role,
          email: r.email,
          phone: r.phone,
          joinedAt: r.joinedAt ?? todayISO(),
          hue: HUES[i % HUES.length],
        },
        teamIds,
      });
      i += 1;
    });
    const msg =
      tp("import.done", importable.length) +
      (skippedDupes > 0 ? ` · ${tp("import.duplicates", skippedDupes)}` : "");
    push(msg, skippedDupes > 0 ? "warn" : "ok");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={t("import.title")}
      subtitle={t("import.sub")}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className={btnPrimary} onClick={run} disabled={importable.length === 0}>
            <IconUpload className="w-4 h-4" /> {tp("import.run", importable.length)}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* template */}
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-line2 bg-panel2/50 px-4 py-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-mint/10 border border-mint/30 text-mint shrink-0">
            <IconSheet className="w-4.5 h-4.5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t("import.template")}</p>
            <p className="text-[11px] text-mut">{t("import.templateHint")}</p>
          </div>
          <button
            className={btnGhost}
            onClick={() => {
              void downloadPeopleTemplate().then(() => push(t("data.exported")));
            }}
          >
            <IconDownload className="w-4 h-4" /> .xlsx
          </button>
        </div>

        {/* dropzone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition-all duration-200 ${
            dragOver
              ? "border-mint/70 bg-mint/[0.07] scale-[1.01]"
              : "border-line2 bg-panel2/40 hover:border-mint/40 hover:bg-panel2/70"
          }`}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <IconUpload className={`w-6 h-6 ${dragOver ? "text-mint" : "text-dim"}`} />
          <p className="text-sm font-medium">{t("import.drop")}</p>
          <p className="text-xs text-dim">
            {t("import.or")} <span className="text-mint font-medium">{t("import.browse")}</span>
          </p>
          {parsing && <p className="text-xs font-mono text-mut">{t("import.parsing")}</p>}
          {fileName && !parsing && (
            <p className="text-xs font-mono text-mut truncate max-w-full">{fileName}</p>
          )}
        </label>

        {error && (
          <p className="text-xs text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* mode */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mut mb-1.5">
            {t("import.mode")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "add", label: t("import.modeAdd") },
                { key: "replace", label: t("import.modeReplace") },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150 ${
                  mode === m.key
                    ? m.key === "replace"
                      ? "border-coral/50 bg-coral/10 text-coral"
                      : "border-mint/50 bg-mint/10 text-mint"
                    : "border-line text-mut hover:border-line2 hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {mode === "replace" && (
            <p className="text-[11px] text-coral mt-1.5">{t("import.replaceWarn")}</p>
          )}
        </div>

        {/* preview */}
        {rows !== null && rows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mut">
                {tp("import.ready", importable.length)}
              </p>
              {skippedDupes > 0 && (
                <Chip className="text-amber bg-amber/10 border-amber/30">
                  {tp("import.duplicates", skippedDupes)}
                </Chip>
              )}
            </div>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-line divide-y divide-line">
              {rows.slice(0, 40).map((r, i) => {
                const dupe = mode === "add" && existingNames.has(r.name.toLowerCase());
                return (
                  <div
                    key={`${r.name}-${i}`}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs ${dupe ? "opacity-45" : ""}`}
                  >
                    <Avatar name={r.name} hue={HUES[i % HUES.length]} size={24} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">
                        {r.name}
                        {dupe && <span className="text-dim font-normal"> · {t("import.modeAdd")}</span>}
                      </span>
                      <span className="block text-[11px] text-mut truncate">
                        {[r.role, r.email].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                    {r.teamNames.length > 0 && (
                      <span className="font-mono text-[10px] text-dim truncate max-w-[110px]">
                        {r.teamNames.join("; ")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* warnings */}
        {allWarnings.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber mb-1.5">
              {t("import.notes")} · {allWarnings.length}
            </p>
            <ul className="space-y-1 max-h-28 overflow-y-auto">
              {allWarnings.map((w, i) => {
                const text =
                  w.kind === "noName"
                    ? t("import.noName", { n: w.row })
                    : w.kind === "badDate"
                    ? t("import.badDate", { n: w.row })
                    : w.kind === "dupInFile"
                    ? t("import.dupInFile", { n: w.row, name: w.name })
                    : t("import.unknownTeam", { n: w.row, team: w.team });
                return (
                  <li key={i} className="text-[11px] text-amber/90 bg-amber/[0.06] border border-amber/20 rounded-md px-2.5 py-1.5">
                    {text}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
