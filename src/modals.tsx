import { useEffect, useState } from "react";
import type { EventKind, Person, Task, TaskStatus, Team, TeamColor } from "./types";
import { makeEvent, useStore } from "./store";
import { uid } from "./data";
import { addDays, todayISO } from "./dates";
import { KIND_META, KIND_ORDER, TEAM_COLORS, TEAM_COLOR_KEYS } from "./meta";
import { Avatar, Chip, Field, Modal, Select, TextArea, TextInput, btnGhost, btnPrimary, useToast } from "./ui";
import { IconCheck, IconSearch } from "./icons";

const RANGE_KINDS: EventKind[] = ["absence", "sick", "leave"];

/* ================= Person ================= */

export function PersonModal({
  open,
  onClose,
  person,
}: {
  open: boolean;
  onClose: () => void;
  person: Person | null;
}) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", role: "", email: "", phone: "", joinedAt: todayISO(), teamIds: [] as string[] });
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setForm(
      person
        ? {
            name: person.name,
            role: person.role,
            email: person.email,
            phone: person.phone,
            joinedAt: person.joinedAt,
            teamIds: state.teams.filter((t) => t.memberIds.includes(person.id)).map((t) => t.id),
          }
        : { name: "", role: "", email: "", phone: "", joinedAt: todayISO(), teamIds: [] }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, person]);

  const toggleTeam = (id: string) =>
    setForm((f) => ({
      ...f,
      teamIds: f.teamIds.includes(id) ? f.teamIds.filter((x) => x !== id) : [...f.teamIds, id],
    }));

  const save = () => {
    if (!form.name.trim()) {
      setErr("A name is required for the roster.");
      return;
    }
    const p: Person = {
      id: person?.id ?? uid(),
      name: form.name.trim(),
      role: form.role.trim() || "Staff",
      email: form.email.trim(),
      phone: form.phone.trim(),
      joinedAt: form.joinedAt || todayISO(),
      hue: person?.hue ?? Math.floor(Math.random() * 360),
    };
    if (person) {
      dispatch({ type: "UPDATE_PERSON", person: p, teamIds: form.teamIds });
      push(`${p.name}'s details updated`);
    } else {
      dispatch({ type: "ADD_PERSON", person: p, teamIds: form.teamIds });
      push(`${p.name} added to the roster`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={person ? "Edit subordinate" : "New subordinate"}
      subtitle={person ? person.name : "Add someone to your roster"}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={save}>
            <IconCheck className="w-4 h-4" /> {person ? "Save changes" : "Add to roster"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name" error={err}>
          <TextInput
            autoFocus
            placeholder="e.g. Nadia Osman"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role / title">
            <TextInput
              placeholder="e.g. Records Clerk"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            />
          </Field>
          <Field label="Joined on">
            <TextInput
              type="date"
              value={form.joinedAt}
              onChange={(e) => setForm((f) => ({ ...f, joinedAt: e.target.value }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <TextInput
              type="email"
              placeholder="name@office.co"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label="Phone">
            <TextInput
              placeholder="+00 …"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Team membership">
          {state.teams.length === 0 ? (
            <p className="text-sm text-dim">No teams yet — create one in the Teams section.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {state.teams.map((t) => {
                const on = form.teamIds.includes(t.id);
                const c = TEAM_COLORS[t.color];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTeam(t.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                      on ? c.chip : "border-line2 text-mut hover:text-ink hover:bg-panel2"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {t.name}
                    {on && <IconCheck className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}

/* ================= Team ================= */

export function TeamModal({
  open,
  onClose,
  team,
}: {
  open: boolean;
  onClose: () => void;
  team: Team | null;
}) {
  const { dispatch } = useStore();
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", purpose: "", color: "mint" as TeamColor });
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setForm(team ? { name: team.name, purpose: team.purpose, color: team.color } : { name: "", purpose: "", color: "mint" });
  }, [open, team]);

  const save = () => {
    if (!form.name.trim()) {
      setErr("Give the team a name.");
      return;
    }
    if (team) {
      dispatch({
        type: "UPDATE_TEAM",
        team: { ...team, name: form.name.trim(), purpose: form.purpose.trim(), color: form.color },
      });
      push(`Team "${form.name.trim()}" updated`);
    } else {
      dispatch({
        type: "ADD_TEAM",
        team: {
          id: uid(),
          name: form.name.trim(),
          purpose: form.purpose.trim(),
          color: form.color,
          memberIds: [],
          createdAt: new Date().toISOString(),
        },
      });
      push(`Team "${form.name.trim()}" created`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={team ? "Edit team" : "New team"}
      subtitle={team ? team.name : "A named crew you can assign tasks to"}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={save}>
            <IconCheck className="w-4 h-4" /> {team ? "Save changes" : "Create team"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Team name" error={err}>
          <TextInput
            autoFocus
            placeholder="e.g. Night Shift"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <Field label="Purpose">
          <TextInput
            placeholder="What is this team responsible for?"
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </Field>
        <Field label="Colour tag">
          <div className="flex gap-2.5">
            {TEAM_COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                title={TEAM_COLORS[c].label}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`w-8 h-8 rounded-full ${TEAM_COLORS[c].swatch} transition-all duration-150 ${
                  form.color === c
                    ? "ring-2 ring-offset-2 ring-offset-panel ring-ink/70 scale-110"
                    : "opacity-55 hover:opacity-90"
                }`}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

/* ================= Team members ================= */

export function MembersModal({
  open,
  onClose,
  team,
}: {
  open: boolean;
  onClose: () => void;
  team: Team | null;
}) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || !team) return;
    setSelected(team.memberIds);
    setQuery("");
  }, [open, team]);

  if (!team) return null;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const list = state.people.filter((p) =>
    (p.name + " " + p.role).toLowerCase().includes(query.toLowerCase())
  );

  const save = () => {
    dispatch({ type: "SET_TEAM_MEMBERS", teamId: team.id, memberIds: selected });
    push(`${team.name}: ${selected.length} member${selected.length === 1 ? "" : "s"} assigned`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Members of ${team.name}`}
      subtitle="Tick who belongs to this team"
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={save}>
            <IconCheck className="w-4 h-4" /> Save roster
          </button>
        </>
      }
    >
      <div className="relative mb-3">
        <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <TextInput
          className="pl-9"
          placeholder="Search people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {list.length === 0 && <p className="text-sm text-dim py-4 text-center">Nobody matches that search.</p>}
        {list.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-150 ${
                on ? "border-mint/50 bg-mint/10" : "border-line2 hover:bg-panel2"
              }`}
            >
              <Avatar name={p.name} hue={p.hue} size={30} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{p.name}</span>
                <span className="block text-xs text-mut truncate">{p.role}</span>
              </span>
              <span
                className={`w-5 h-5 rounded-full border inline-flex items-center justify-center transition ${
                  on ? "bg-mint border-mint text-[#0b130e]" : "border-line2 text-transparent"
                }`}
              >
                <IconCheck className="w-3 h-3" />
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/* ================= Task ================= */

export function TaskModal({
  open,
  onClose,
  task,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
}) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const [form, setForm] = useState({
    title: "",
    description: "",
    teamId: "",
    assigneeIds: [] as string[],
    dueDate: addDays(todayISO(), 7),
    status: "todo" as TaskStatus,
  });
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setForm(
      task
        ? {
            title: task.title,
            description: task.description,
            teamId: task.teamId ?? "",
            assigneeIds: task.assigneeIds,
            dueDate: task.dueDate,
            status: task.status,
          }
        : { title: "", description: "", teamId: "", assigneeIds: [], dueDate: addDays(todayISO(), 7), status: "todo" }
    );
  }, [open, task]);

  const countInvolved = (teamId: string, assigneeIds: string[]) => {
    const team = state.teams.find((t) => t.id === teamId);
    const ids = new Set([...(team?.memberIds ?? []), ...assigneeIds]);
    return [...ids].filter((id) => state.people.some((p) => p.id === id)).length;
  };

  const save = () => {
    if (!form.title.trim()) {
      setErr("The task needs a title.");
      return;
    }
    if (!form.dueDate) {
      setErr("Pick a due date.");
      return;
    }
    if (task) {
      dispatch({
        type: "UPDATE_TASK",
        prev: task,
        task: {
          ...task,
          title: form.title.trim(),
          description: form.description.trim(),
          teamId: form.teamId || null,
          assigneeIds: form.assigneeIds,
          dueDate: form.dueDate,
          status: form.status,
        },
      });
      push(`Task "${form.title.trim()}" updated`);
    } else {
      const n = countInvolved(form.teamId, form.assigneeIds);
      dispatch({
        type: "ADD_TASK",
        task: {
          id: uid(),
          title: form.title.trim(),
          description: form.description.trim(),
          teamId: form.teamId || null,
          assigneeIds: form.assigneeIds,
          status: form.status,
          dueDate: form.dueDate,
          createdAt: new Date().toISOString(),
          completedAt: form.status === "done" ? todayISO() : null,
        },
      });
      push(
        n > 0
          ? `Task created — assignment logged for ${n} people`
          : "Task created (no team or assignees yet)"
      );
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      subtitle={task ? task.title : "Assign work to a team or individuals, with a due date"}
      wide
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={save}>
            <IconCheck className="w-4 h-4" /> {task ? "Save changes" : "Create task"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Task title" error={err}>
          <TextInput
            autoFocus
            placeholder="e.g. Prepare the monthly roster"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </Field>
        <Field label="Notes">
          <TextArea
            rows={2}
            placeholder="Anything the team should know…"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assigned team">
            <Select value={form.teamId} onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}>
              <option value="">— No team —</option>
              {state.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <TextInput
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Also assign individuals">
          {state.people.length === 0 ? (
            <p className="text-sm text-dim">No people on the roster yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {state.people.map((p) => {
                const on = form.assigneeIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        assigneeIds: on
                          ? f.assigneeIds.filter((x) => x !== p.id)
                          : [...f.assigneeIds, p.id],
                      }))
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs transition-all duration-150 ${
                      on ? "border-mint/50 bg-mint/10 text-ink" : "border-line2 text-mut hover:text-ink hover:bg-panel2"
                    }`}
                  >
                    <Avatar name={p.name} hue={p.hue} size={20} />
                    {p.name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
        <Field label="Starting status">
          <div className="flex gap-2">
            {(["todo", "active", "done"] as TaskStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm((f) => ({ ...f, status: s }))}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  form.status === s
                    ? s === "done"
                      ? "border-mint/50 bg-mint/10 text-mint"
                      : s === "active"
                      ? "border-amber/50 bg-amber/10 text-amber"
                      : "border-sky/50 bg-sky/10 text-sky"
                    : "border-line2 text-mut hover:text-ink hover:bg-panel2"
                }`}
              >
                {s === "todo" ? "To do" : s === "active" ? "Active" : "Done"}
              </button>
            ))}
          </div>
        </Field>
        {form.teamId && (
          <p className="text-xs text-mut">
            Creating this task logs an <Chip className={KIND_META.task.chip}>Assignment</Chip> entry on the record
            of every member of the chosen team.
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ================= Event ================= */

export function EventModal({
  open,
  onClose,
  personId,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
}) {
  const { state, dispatch } = useStore();
  const { push } = useToast();
  const person = state.people.find((p) => p.id === personId);
  const [kind, setKind] = useState<EventKind>("observation");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind("observation");
    setTitle("");
    setDate(todayISO());
    setEndDate("");
    setNote("");
    setErr("");
  }, [open, personId]);

  if (!person) return null;
  const isRange = RANGE_KINDS.includes(kind);

  const save = () => {
    if (!title.trim()) {
      setErr("Describe what happened.");
      return;
    }
    if (!date) {
      setErr("Pick the date it happened.");
      return;
    }
    if (isRange && endDate && endDate < date) {
      setErr("The end date is before the start date.");
      return;
    }
    dispatch({
      type: "ADD_EVENT",
      event: makeEvent({
        personId,
        kind,
        title: title.trim(),
        note: note.trim(),
        date,
        endDate: isRange && endDate ? endDate : null,
        taskId: null,
      }),
    });
    push(`${KIND_META[kind].label} logged for ${person.name}`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an event"
      subtitle={`On ${person.name}'s service record`}
      wide
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={save}>
            <IconCheck className="w-4 h-4" /> Log to record
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-mut mb-1.5">
            Type of event
          </span>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {KIND_ORDER.map((k) => {
              const m = KIND_META[k];
              const on = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 text-[10.5px] font-medium transition-all duration-150 ${
                    on ? m.node : "border-line2 text-mut hover:text-ink hover:bg-panel2"
                  }`}
                >
                  <m.Icon className="w-4 h-4" />
                  {m.label.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="What happened" error={err}>
          <TextInput
            autoFocus
            placeholder={
              kind === "commendation"
                ? "e.g. Handled the audit single-handedly"
                : kind === "misconduct"
                ? "e.g. Skipped the safety checklist"
                : kind === "absence"
                ? "e.g. Absent — no call, no show"
                : kind === "sick"
                ? "e.g. Sick day — migraine"
                : kind === "leave"
                ? "e.g. Annual leave — approved"
                : kind === "task"
                ? "e.g. Handed the monthly report"
                : "e.g. Suggested a better filing order"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className={`grid gap-3 ${isRange ? "grid-cols-2" : "grid-cols-2"}`}>
          <Field label={isRange ? "From date" : "Date"}>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {isRange ? (
            <Field label="Until (optional)">
              <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          ) : (
            <Field label="Context">
              <TextInput
                placeholder="Optional one-liner"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          )}
        </div>
        {isRange && (
          <Field label="Notes">
            <TextArea rows={2} placeholder="Details, approvals, certificates…" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
