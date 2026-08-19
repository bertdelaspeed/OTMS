import type { FC, SVGProps } from "react";
import type { EventKind, StatusKey, TeamColor } from "./types";
import {
  IconActivity,
  IconAlert,
  IconBriefcase,
  IconEye,
  IconStar,
  IconSun,
  IconUserX,
} from "./icons";

export const KIND_META: Record<
  EventKind,
  {
    label: string;
    Icon: FC<SVGProps<SVGSVGElement>>;
    chip: string;
    dot: string;
    node: string;
  }
> = {
  commendation: {
    label: "Commendation",
    Icon: IconStar,
    chip: "text-amber bg-amber/10 border-amber/30",
    dot: "bg-amber",
    node: "bg-amber/15 text-amber border-amber/40",
  },
  misconduct: {
    label: "Misconduct",
    Icon: IconAlert,
    chip: "text-coral bg-coral/10 border-coral/30",
    dot: "bg-coral",
    node: "bg-coral/15 text-coral border-coral/40",
  },
  absence: {
    label: "Absence",
    Icon: IconUserX,
    chip: "text-rose bg-rose/10 border-rose/30",
    dot: "bg-rose",
    node: "bg-rose/15 text-rose border-rose/40",
  },
  sick: {
    label: "Sick day",
    Icon: IconActivity,
    chip: "text-cyan bg-cyan/10 border-cyan/30",
    dot: "bg-cyan",
    node: "bg-cyan/15 text-cyan border-cyan/40",
  },
  leave: {
    label: "Leave",
    Icon: IconSun,
    chip: "text-sky bg-sky/10 border-sky/30",
    dot: "bg-sky",
    node: "bg-sky/15 text-sky border-sky/40",
  },
  task: {
    label: "Task",
    Icon: IconBriefcase,
    chip: "text-mint bg-mint/10 border-mint/30",
    dot: "bg-mint",
    node: "bg-mint/15 text-mint border-mint/40",
  },
  observation: {
    label: "Observation",
    Icon: IconEye,
    chip: "text-sage bg-sage/10 border-sage/30",
    dot: "bg-sage",
    node: "bg-sage/15 text-sage border-sage/40",
  },
};

export const KIND_ORDER: EventKind[] = [
  "commendation",
  "misconduct",
  "absence",
  "sick",
  "leave",
  "task",
  "observation",
];

export const STATUS_META: Record<
  StatusKey,
  { label: string; chip: string; dot: string; bar: string; text: string }
> = {
  available: {
    label: "Available",
    chip: "text-mint bg-mint/10 border-mint/30",
    dot: "bg-mint",
    bar: "bg-mint",
    text: "text-mint",
  },
  "on-task": {
    label: "On task",
    chip: "text-amber bg-amber/10 border-amber/30",
    dot: "bg-amber",
    bar: "bg-amber",
    text: "text-amber",
  },
  absent: {
    label: "Absent",
    chip: "text-rose bg-rose/10 border-rose/30",
    dot: "bg-rose",
    bar: "bg-rose",
    text: "text-rose",
  },
  sick: {
    label: "Sick",
    chip: "text-cyan bg-cyan/10 border-cyan/30",
    dot: "bg-cyan",
    bar: "bg-cyan",
    text: "text-cyan",
  },
  leave: {
    label: "On leave",
    chip: "text-sky bg-sky/10 border-sky/30",
    dot: "bg-sky",
    bar: "bg-sky",
    text: "text-sky",
  },
};

export const STATUS_ORDER: StatusKey[] = ["available", "on-task", "absent", "sick", "leave"];

export const TEAM_COLORS: Record<
  TeamColor,
  { label: string; swatch: string; bar: string; chip: string; dot: string }
> = {
  amber: {
    label: "Amber",
    swatch: "bg-amber",
    bar: "bg-amber",
    chip: "text-amber bg-amber/10 border-amber/30",
    dot: "bg-amber",
  },
  coral: {
    label: "Coral",
    swatch: "bg-coral",
    bar: "bg-coral",
    chip: "text-coral bg-coral/10 border-coral/30",
    dot: "bg-coral",
  },
  mint: {
    label: "Mint",
    swatch: "bg-mint",
    bar: "bg-mint",
    chip: "text-mint bg-mint/10 border-mint/30",
    dot: "bg-mint",
  },
  sky: {
    label: "Sky",
    swatch: "bg-sky",
    bar: "bg-sky",
    chip: "text-sky bg-sky/10 border-sky/30",
    dot: "bg-sky",
  },
  cyan: {
    label: "Cyan",
    swatch: "bg-cyan",
    bar: "bg-cyan",
    chip: "text-cyan bg-cyan/10 border-cyan/30",
    dot: "bg-cyan",
  },
  rose: {
    label: "Rose",
    swatch: "bg-rose",
    bar: "bg-rose",
    chip: "text-rose bg-rose/10 border-rose/30",
    dot: "bg-rose",
  },
};

export const TEAM_COLOR_KEYS: TeamColor[] = ["amber", "coral", "mint", "sky", "cyan", "rose"];

export const TASK_STATUS_LABEL: Record<"todo" | "active" | "done", string> = {
  todo: "To do",
  active: "Active",
  done: "Done",
};
