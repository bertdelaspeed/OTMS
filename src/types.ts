export type ViewKey = "dashboard" | "people" | "teams" | "tasks" | "calendar" | "activity" | "database" | "audit";

export type EventKind =
  | "commendation"
  | "misconduct"
  | "absence"
  | "sick"
  | "leave"
  | "permission"
  | "task"
  | "observation";

export type StatusKey = "available" | "on-task" | "on-mission" | "errand" | "absent" | "sick" | "leave";

export type TeamColor = "amber" | "coral" | "mint" | "sky" | "cyan" | "rose";

export type TaskStatus = "todo" | "active" | "done";

export interface Person {
  id: string;
  name: string;
  matricule: string;
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
  archived?: boolean; // completed tasks filed away from the working list
  isMission?: boolean; // mission = people are away in another city
}

export interface PersonEvent {
  id: string;
  personId: string;
  kind: EventKind;
  title: string;
  note: string;
  date: string; // ISO date of occurrence / range start
  endDate: string | null; // ISO date for ranges (leave, sick, absence)
  timeFrom?: string | null; // HH:MM — short permissions only
  timeTo?: string | null; // HH:MM — short permissions only
  createdAt: string; // ISO datetime the record was logged
  taskId: string | null;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO datetime
  action: "create" | "update" | "delete";
  entityType: "person" | "team" | "task" | "event";
  entityId: string;
  entityName: string; // human-readable name for display
  details?: string; // additional context
  previousState?: any; // for updates, store what changed
  newState?: any; // for updates, store the new state
}

export interface AppState {
  people: Person[];
  teams: Team[];
  tasks: Task[];
  events: PersonEvent[];
  auditLog: AuditLogEntry[];
}
