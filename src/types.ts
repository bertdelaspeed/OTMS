export type ViewKey = "dashboard" | "people" | "teams" | "tasks" | "calendar";

export type EventKind =
  | "commendation"
  | "misconduct"
  | "absence"
  | "sick"
  | "leave"
  | "task"
  | "observation";

export type StatusKey = "available" | "on-task" | "absent" | "sick" | "leave";

export type TeamColor = "amber" | "coral" | "mint" | "sky" | "cyan" | "rose";

export type TaskStatus = "todo" | "active" | "done";

export interface Person {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  joinedAt: string; // ISO date
  hue: number;
}

export interface Team {
  id: string;
  name: string;
  color: TeamColor;
  purpose: string;
  memberIds: string[];
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  teamId: string | null;
  assigneeIds: string[];
  status: TaskStatus;
  startDate: string; // ISO date — work period start; people are "taken" from here
  dueDate: string; // ISO date — work period end / deadline
  createdAt: string; // ISO datetime
  completedAt: string | null;
}

export interface PersonEvent {
  id: string;
  personId: string;
  kind: EventKind;
  title: string;
  note: string;
  date: string; // ISO date of occurrence / range start
  endDate: string | null; // ISO date for ranges (leave, sick, absence)
  createdAt: string; // ISO datetime the record was logged
  taskId: string | null;
}

export interface AppState {
  people: Person[];
  teams: Team[];
  tasks: Task[];
  events: PersonEvent[];
}
