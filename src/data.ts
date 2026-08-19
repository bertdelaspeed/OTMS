import type { AppState, Person, PersonEvent, Task, Team, EventKind } from "./types";
import { addDays, todayISO } from "./dates";

export function uid(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export function seedState(): AppState {
  const t = todayISO();
  const d = (n: number) => addDays(t, n);
  const at = (daysAgo: number, hour = 10): string => {
    const dt = new Date();
    dt.setDate(dt.getDate() - daysAgo);
    dt.setHours(hour, (daysAgo * 7) % 60, 0, 0);
    return dt.toISOString();
  };

  const person = (
    id: string,
    name: string,
    role: string,
    email: string,
    phone: string,
    joinedDaysAgo: number,
    hue: number
  ): Person => ({ id, name, role, email, phone, joinedAt: d(-joinedDaysAgo), hue });

  const people: Person[] = [
    person("p-amara", "Amara Diallo", "Senior Client Officer", "amara.diallo@office.co", "+221 77 512 0931", 742, 152),
    person("p-jonas", "Jonas Weber", "Operations Associate", "jonas.weber@office.co", "+49 160 442 7810", 511, 28),
    person("p-priya", "Priya Nair", "Records Clerk", "priya.nair@office.co", "+91 98 4701 2236", 388, 268),
    person("p-tomas", "Tomás Rivera", "Field Agent", "tomas.rivera@office.co", "+34 612 884 207", 295, 200),
    person("p-lena", "Lena Kovács", "Compliance Analyst", "lena.kovacs@office.co", "+36 30 998 1154", 240, 340),
    person("p-samuel", "Samuel Okafor", "Field Agent", "samuel.okafor@office.co", "+234 803 556 9012", 173, 88),
    person("p-ingrid", "Ingrid Halvorsen", "Front Desk", "ingrid.halvorsen@office.co", "+47 912 44 738", 129, 12),
    person("p-marco", "Marco Bianchi", "Logistics Coordinator", "marco.bianchi@office.co", "+39 333 201 8845", 76, 220),
    person("p-aisha", "Aisha Bello", "Junior Analyst", "aisha.bello@office.co", "+233 24 887 3361", 34, 56),
  ];

  const teams: Team[] = [
    {
      id: "team-cs",
      name: "Client Services",
      color: "sky",
      purpose: "Front-desk requests, intake & client care",
      memberIds: ["p-amara", "p-ingrid"],
      createdAt: at(90),
    },
    {
      id: "team-bo",
      name: "Back Office",
      color: "amber",
      purpose: "Records, compliance & reporting",
      memberIds: ["p-jonas", "p-priya", "p-lena", "p-aisha"],
      createdAt: at(90),
    },
    {
      id: "team-fo",
      name: "Field Ops",
      color: "coral",
      purpose: "Site visits, logistics & stock",
      memberIds: ["p-tomas", "p-samuel", "p-marco"],
      createdAt: at(60),
    },
  ];

  const tasks: Task[] = [
    {
      id: "t-audit",
      title: "Q3 client file audit",
      description: "Verify every client file against the new checklist.",
      teamId: "team-bo",
      assigneeIds: [],
      status: "active",
      dueDate: d(2),
      createdAt: at(5),
      completedAt: null,
    },
    {
      id: "t-digest",
      title: "Quarterly compliance digest",
      description: "Compile findings for the quarterly board memo.",
      teamId: "team-bo",
      assigneeIds: [],
      status: "active",
      dueDate: d(-1),
      createdAt: at(9),
      completedAt: null,
    },
    {
      id: "t-intake",
      title: "Client intake script refresh",
      description: "Rewrite the intake script around the new data policy.",
      teamId: "team-cs",
      assigneeIds: [],
      status: "active",
      dueDate: d(4),
      createdAt: at(3),
      completedAt: null,
    },
    {
      id: "t-cert",
      title: "Renew premises safety certificates",
      description: "Book the inspector and chase the paperwork.",
      teamId: "team-fo",
      assigneeIds: [],
      status: "todo",
      dueDate: d(6),
      createdAt: at(4),
      completedAt: null,
    },
    {
      id: "t-stock",
      title: "Warehouse stocktake",
      description: "Full count of bay 3 and the consumables shelf.",
      teamId: "team-fo",
      assigneeIds: [],
      status: "todo",
      dueDate: d(9),
      createdAt: at(2),
      completedAt: null,
    },
    {
      id: "t-temp",
      title: "Onboard temp reception cover",
      description: "Prepare badge, desk sheet and system access for the temp.",
      teamId: "team-cs",
      assigneeIds: [],
      status: "todo",
      dueDate: d(12),
      createdAt: at(1),
      completedAt: null,
    },
    {
      id: "t-archive",
      title: "Archive 2024 paper records",
      description: "Box, index and move 2024 records to the archive room.",
      teamId: "team-bo",
      assigneeIds: [],
      status: "done",
      dueDate: d(-5),
      createdAt: at(14),
      completedAt: d(-6),
    },
  ];

  const ev = (
    personId: string,
    kind: EventKind,
    title: string,
    daysAgo: number,
    opts: Partial<PersonEvent> = {}
  ): PersonEvent => ({
    id: uid(),
    personId,
    kind,
    title,
    note: "",
    date: d(-daysAgo),
    endDate: null,
    createdAt: at(daysAgo),
    taskId: null,
    ...opts,
  });

  const events: PersonEvent[] = [
    // Today / covering today
    ev("p-ingrid", "leave", "Annual leave — family visit", 0, {
      endDate: d(2),
      note: "Approved last week. Back at the desk after the weekend.",
    }),
    ev("p-jonas", "sick", "Sick day — flu", 0, { note: "Called in at 08:40." }),
    ev("p-marco", "observation", "Requested a schedule swap next week", 0, {
      note: "Wants Tuesday off in exchange for Saturday shift.",
    }),
    // Recent history
    ev("p-aisha", "observation", "Arrived late to morning briefing", 1, {
      note: "Second time this month — keep an eye on it.",
    }),
    ev("p-amara", "commendation", "De-escalated a heated intake call", 1, {
      note: "The client emailed afterwards to praise her by name.",
    }),
    ev("p-lena", "observation", "Kept the shared drive tidy during audit week", 2),
    ev("p-tomas", "absence", "Absent — no call, no show", 3, {
      note: "Follow-up meeting scheduled. Verbal warning if it repeats.",
    }),
    ev("p-samuel", "commendation", "Finished his route two hours ahead of schedule", 4),
    ev("p-priya", "commendation", "Caught a duplicate invoice before payout", 6, {
      note: "Saved the office a double charge worth a full day's budget.",
    }),
    ev("p-jonas", "task", "Completed: Archive 2024 paper records", 6, { taskId: "t-archive" }),
    ev("p-priya", "task", "Completed: Archive 2024 paper records", 6, { taskId: "t-archive" }),
    ev("p-marco", "misconduct", "Left a site visit unattended for 40 minutes", 8, {
      note: "Verbal warning given and noted on file.",
    }),
    ev("p-lena", "commendation", "Zero findings in the internal spot-check", 9),
    ev("p-marco", "observation", "Flagged a broken pallet jack in bay 3", 12),
    ev("p-ingrid", "leave", "Paid leave — personal errands", 13, { endDate: d(-12) }),
    ev("p-tomas", "sick", "Sick leave — back strain", 15, { endDate: d(-14), note: "Doctor's note received." }),
    ev("p-jonas", "misconduct", "Missed the records handover deadline twice", 16, {
      note: "Written note placed on file after the second miss.",
    }),
    ev("p-samuel", "absence", "Absence — unreported", 20, { note: "Resolved after same-day phone check." }),
    ev("p-amara", "task", "Assigned: Client intake script refresh", 3, { taskId: "t-intake" }),
    ev("p-jonas", "task", "Assigned: Q3 client file audit", 5, { taskId: "t-audit" }),
    ev("p-priya", "task", "Assigned: Q3 client file audit", 5, { taskId: "t-audit" }),
    ev("p-lena", "task", "Assigned: Q3 client file audit", 5, { taskId: "t-audit" }),
    ev("p-aisha", "task", "Assigned: Q3 client file audit", 5, { taskId: "t-audit" }),
  ];

  return { people, teams, tasks, events };
}
