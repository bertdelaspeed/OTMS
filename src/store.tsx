import { createContext, useContext, useEffect, useReducer } from "react";
import type { Dispatch, ReactNode } from "react";
import type {
  AppState,
  Person,
  PersonEvent,
  StatusKey,
  Task,
  TaskStatus,
  Team,
} from "./types";
import { seedState, uid } from "./data";
import { nowInWindow, todayISO } from "./dates";

const KEY = "rollcall.state.v2";

export type Action =
  | { type: "ADD_PERSON"; person: Person; teamIds: string[] }
  | { type: "UPDATE_PERSON"; person: Person; teamIds: string[] }
  | { type: "REMOVE_PERSON"; id: string }
  | { type: "ADD_TEAM"; team: Team }
  | { type: "UPDATE_TEAM"; team: Team }
  | { type: "REMOVE_TEAM"; id: string }
  | { type: "SET_TEAM_MEMBERS"; teamId: string; memberIds: string[] }
  | { type: "ADD_TASK"; task: Task }
  | { type: "UPDATE_TASK"; task: Task; prev: Task }
  | { type: "SET_TASK_STATUS"; id: string; status: TaskStatus }
  | { type: "SET_TASK_ARCHIVED"; id: string; archived: boolean }
  | { type: "REMOVE_TASK"; id: string }
  | { type: "ADD_EVENT"; event: PersonEvent }
  | { type: "REMOVE_EVENT"; id: string }
  | { type: "RESET"; state: AppState };

export function makeEvent(partial: Omit<PersonEvent, "id" | "createdAt">): PersonEvent {
  return { id: uid(), createdAt: new Date().toISOString(), ...partial };
}

/** Union of people implicated by a task: its team's members plus direct assignees. */
export function involvedIds(state: AppState, task: Task): string[] {
  const team = task.teamId ? state.teams.find((t) => t.id === task.teamId) : null;
  const ids = new Set<string>([...(team?.memberIds ?? []), ...task.assigneeIds]);
  return [...ids].filter((id) => state.people.some((p) => p.id === id));
}

/** True when the task's work period covers the given day. */
export function taskCovers(task: Task, day: string): boolean {
  return task.startDate <= day && day <= task.dueDate;
}

/**
 * True when the task makes its people unavailable on `day`:
 * an in-progress (active) task always does; a planned (todo) task does
 * only inside its work period. Done tasks never do.
 */
export function taskBlocks(task: Task, day: string): boolean {
  if (task.status === "done") return false;
  if (task.status === "active") return true;
  return taskCovers(task, day);
}

function completionEvents(state: AppState, task: Task): PersonEvent[] {
  return involvedIds(state, task).map((pid) =>
    makeEvent({
      personId: pid,
      kind: "task",
      title: `Completed: ${task.title}`,
      note: "",
      date: todayISO(),
      endDate: null,
      taskId: task.id,
    })
  );
}

function reducer(state: AppState, a: Action): AppState {
  switch (a.type) {
    case "ADD_PERSON": {
      const teams = state.teams.map((t) =>
        a.teamIds.includes(t.id) && !t.memberIds.includes(a.person.id)
          ? { ...t, memberIds: [...t.memberIds, a.person.id] }
          : t
      );
      return { ...state, people: [...state.people, a.person], teams };
    }
    case "UPDATE_PERSON": {
      const teams = state.teams.map((t) => {
        const has = t.memberIds.includes(a.person.id);
        const want = a.teamIds.includes(t.id);
        if (want && !has) return { ...t, memberIds: [...t.memberIds, a.person.id] };
        if (!want && has) return { ...t, memberIds: t.memberIds.filter((id) => id !== a.person.id) };
        return t;
      });
      return {
        ...state,
        people: state.people.map((p) => (p.id === a.person.id ? a.person : p)),
        teams,
      };
    }
    case "REMOVE_PERSON":
      return {
        ...state,
        people: state.people.filter((p) => p.id !== a.id),
        teams: state.teams.map((t) => ({
          ...t,
          memberIds: t.memberIds.filter((id) => id !== a.id),
        })),
        tasks: state.tasks.map((t) => ({
          ...t,
          assigneeIds: t.assigneeIds.filter((id) => id !== a.id),
        })),
        events: state.events.filter((e) => e.personId !== a.id),
      };
    case "ADD_TEAM":
      return { ...state, teams: [...state.teams, a.team] };
    case "UPDATE_TEAM":
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === a.team.id
            ? { ...t, name: a.team.name, color: a.team.color, purpose: a.team.purpose }
            : t
        ),
      };
    case "REMOVE_TEAM":
      return {
        ...state,
        teams: state.teams.filter((t) => t.id !== a.id),
        tasks: state.tasks.map((t) => (t.teamId === a.id ? { ...t, teamId: null } : t)),
      };
    case "SET_TEAM_MEMBERS":
      return {
        ...state,
        teams: state.teams.map((t) => (t.id === a.teamId ? { ...t, memberIds: a.memberIds } : t)),
      };
    case "ADD_TASK": {
      const events = [
        ...state.events,
        ...involvedIds(state, a.task).map((pid) =>
          makeEvent({
            personId: pid,
            kind: "task",
            title: `Assigned: ${a.task.title}`,
            note: "",
            date: todayISO(),
            endDate: null,
            taskId: a.task.id,
          })
        ),
      ];
      return { ...state, tasks: [...state.tasks, a.task], events };
    }
    case "UPDATE_TASK": {
      let events = state.events;
      if (a.task.status === "done" && a.prev.status !== "done") {
        events = [...events, ...completionEvents(state, a.task)];
      }
      return { ...state, tasks: state.tasks.map((t) => (t.id === a.task.id ? a.task : t)), events };
    }
    case "SET_TASK_STATUS": {
      const task = state.tasks.find((t) => t.id === a.id);
      if (!task || task.status === a.status) return state;
      const updated: Task = {
        ...task,
        status: a.status,
        completedAt: a.status === "done" ? todayISO() : null,
      };
      let events = state.events;
      if (a.status === "done") events = [...events, ...completionEvents(state, task)];
      return { ...state, tasks: state.tasks.map((t) => (t.id === a.id ? updated : t)), events };
    }
    case "SET_TASK_ARCHIVED":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === a.id ? { ...t, archived: a.archived } : t)),
      };
    case "REMOVE_TASK":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== a.id) };
    case "ADD_EVENT":
      return { ...state, events: [...state.events, a.event] };
    case "REMOVE_EVENT":
      return { ...state, events: state.events.filter((e) => e.id !== a.id) };
    case "RESET":
      return a.state;
    default:
      return state;
  }
}

/** Tolerate older backups: give tasks without a startDate a sane one. */
function normalize(s: AppState): AppState {
  return {
    ...s,
    tasks: (s.tasks ?? []).map((t) => ({
      ...t,
      startDate:
        t.startDate ?? (t.createdAt ? t.createdAt.slice(0, 10) : t.dueDate) <= t.dueDate
          ? t.startDate ?? (t.createdAt ? t.createdAt.slice(0, 10) : t.dueDate)
          : t.dueDate,
    })),
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s && Array.isArray(s.people) && Array.isArray(s.events)) return normalize(s);
    }
  } catch {
    /* corrupted storage — fall through to seed */
  }
  return seedState();
}

const StoreCtx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }, [state]);
  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/* ---------- derived helpers ---------- */

export function teamsOf(state: AppState, personId: string): Team[] {
  return state.teams.filter((t) => t.memberIds.includes(personId));
}

/** Tasks a person is implicated in that are not yet done, soonest due first. */
export function tasksFor(state: AppState, personId: string): Task[] {
  return state.tasks
    .filter((t) => {
      if (t.status === "done") return false;
      if (t.assigneeIds.includes(personId)) return true;
      if (!t.teamId) return false;
      const team = state.teams.find((tm) => tm.id === t.teamId);
      return !!team && team.memberIds.includes(personId);
    })
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
}

export function activeTasksFor(state: AppState, personId: string): Task[] {
  return tasksFor(state, personId).filter((t) => t.status === "active");
}

/** Tasks that make this person unavailable on `day`, soonest due first. */
export function blockingTasksOn(state: AppState, personId: string, day: string): Task[] {
  return tasksFor(state, personId).filter((t) => taskBlocks(t, day));
}

export interface StatusInfo {
  key: StatusKey;
  detail: string;
}

/**
 * Live status on today:
 * 1. an absence / sick / leave record covering today wins;
 * 2. a short permission whose hour window is running right now → errand;
 * 3. otherwise a task that "takes" the person today (active, or planned
 *    inside its work period) marks them on-task;
 * 4. otherwise they are available.
 */
export function personStatus(state: AppState, personId: string): StatusInfo {
  const today = todayISO();
  const out = state.events
    .filter(
      (e) =>
        e.personId === personId &&
        (e.kind === "absence" || e.kind === "sick" || e.kind === "leave")
    )
    .filter((e) => e.date <= today && (e.endDate ?? e.date) >= today)
    .sort((x, y) => y.date.localeCompare(x.date))[0];
  if (out) {
    const key: StatusKey = out.kind === "absence" ? "absent" : out.kind === "sick" ? "sick" : "leave";
    return { key, detail: out.title };
  }
  const perm = state.events
    .filter(
      (e) =>
        e.personId === personId &&
        e.kind === "permission" &&
        e.date === today &&
        nowInWindow(e.timeFrom, e.timeTo)
    )
    .sort((x, y) => (y.timeTo ?? "").localeCompare(x.timeTo ?? ""))[0];
  if (perm) {
    const range = perm.timeFrom && perm.timeTo ? ` · ${perm.timeFrom} – ${perm.timeTo}` : "";
    return { key: "errand", detail: perm.title + range };
  }
  const blocking = blockingTasksOn(state, personId, today);
  if (blocking.length > 0) {
    const more = blocking.length - 1;
    return { key: "on-task", detail: blocking[0].title + (more > 0 ? ` +${more}` : "") };
  }
  return { key: "available", detail: "" };
}

export function personLastEvent(state: AppState, personId: string): PersonEvent | undefined {
  return state.events
    .filter((e) => e.personId === personId)
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
}
