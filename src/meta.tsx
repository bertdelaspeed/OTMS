import type { FC, SVGProps } from "react";
import type { EventKind, StatusKey, TeamColor } from "./types";
import {
  IconActivity,
  IconAlert,
  IconBriefcase,
  IconClock,
  IconEye,
  IconStar,
  IconSun,
  IconUserX,
} from "./icons";

export const KIND_META: Record<
  EventKind,
  {
    key: string;
    Icon: FC<SVGProps<SVGSVGElement>>;
    chip: string;
    dot: string;
    node: string;
  }
> = {
  commendation: {
    key: "kind.commendation",
    Icon: IconStar,
    chip: "text-amber bg-amber/10 border-amber/30",
    dot: "bg-amber",
    node: "bg-amber/15 text-amber border-amber/40",
  },
  misconduct: {
    key: "kind.misconduct",
    Icon: IconAlert,
    chip: "text-coral bg-coral/10 border-coral/30",
    dot: "bg-coral",
    node: "bg-coral/15 text-coral border-coral/40",
  },
  absence: {
    key: "kind.absence",
    Icon: IconUserX,
    chip: "text-rose bg-rose/10 border-rose/30",
    dot: "bg-rose",
    node: "bg-rose/15 text-rose border-rose/40",
  },
  sick: {
    key: "kind.sick",
    Icon: IconActivity,
    chip: "text-cyan bg-cyan/10 border-cyan/30",
    dot: "bg-cyan",
    node: "bg-cyan/15 text-cyan border-cyan/40",
  },
  leave: {
    key: "kind.leave",
    Icon: IconSun,
    chip: "text-sky bg-sky/10 border-sky/30",
    dot: "bg-sky",
    node: "bg-sky/15 text-sky border-sky/40",
  },
  permission: {
    key: "kind.permission",
    Icon: IconClock,
    chip: "text-orchid bg-orchid/10 border-orchid/30",
    dot: "bg-orchid",
    node: "bg-orchid/15 text-orchid border-orchid/40",
  },
  task: {
    key: "kind.task",
    Icon: IconBriefcase,
    chip: "text-mint bg-mint/10 border-mint/30",
    dot: "bg-mint",
    node: "bg-mint/15 text-mint border-mint/40",
  },
  observation: {
    key: "kind.observation",
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
  "permission",
  "task",
  "observation",
];

/** Kinds that can span several days (they block availability across the range). */
export const RANGE_KINDS: EventKind[] = ["absence", "sick", "leave"];

export const STATUS_META: Record<
  StatusKey,
  { key: string; chip: string; dot: string; bar: string; text: string }
> = {
  available: {
    key: "status.available",
    chip: "text-mint bg-mint/10 border-mint/30",
    dot: "bg-mint",
    bar: "bg-mint",
    text: "text-mint",
  },
  "on-task": {
    key: "status.onTask",
    chip: "text-amber bg-amber/10 border-amber/30",
    dot: "bg-amber",
    bar: "bg-amber",
    text: "text-amber",
  },
  "on-mission": {
    key: "status.onMission",
    chip: "text-purple bg-purple/10 border-purple/30",
    dot: "bg-purple",
    bar: "bg-purple",
    text: "text-purple",
  },
  errand: {
    key: "status.errand",
    chip: "text-orchid bg-orchid/10 border-orchid/30",
    dot: "bg-orchid",
    bar: "bg-orchid",
    text: "text-orchid",
  },
  absent: {
    key: "status.absent",
    chip: "text-rose bg-rose/10 border-rose/30",
    dot: "bg-rose",
    bar: "bg-rose",
    text: "text-rose",
  },
  sick: {
    key: "status.sick",
    chip: "text-cyan bg-cyan/10 border-cyan/30",
    dot: "bg-cyan",
    bar: "bg-cyan",
    text: "text-cyan",
  },
  leave: {
    key: "status.leave",
    chip: "text-sky bg-sky/10 border-sky/30",
    dot: "bg-sky",
    bar: "bg-sky",
    text: "text-sky",
  },
};

export const STATUS_ORDER: StatusKey[] = ["available", "on-task", "on-mission", "errand", "absent", "sick", "leave"];

export const TEAM_COLORS: Record<
  TeamColor,
  { key: string; swatch: string; bar: string; chip: string; dot: string; solid: string }
> = {
  amber: {
    key: "color.amber",
    swatch: "bg-amber",
    bar: "bg-amber",
    chip: "text-amber bg-amber/10 border-amber/30",
    dot: "bg-amber",
    solid: "#e8b04b",
  },
  coral: {
    key: "color.coral",
    swatch: "bg-coral",
    bar: "bg-coral",
    chip: "text-coral bg-coral/10 border-coral/30",
    dot: "bg-coral",
    solid: "#e8705e",
  },
  mint: {
    key: "color.mint",
    swatch: "bg-mint",
    bar: "bg-mint",
    chip: "text-mint bg-mint/10 border-mint/30",
    dot: "bg-mint",
    solid: "#6fcf97",
  },
  sky: {
    key: "color.sky",
    swatch: "bg-sky",
    bar: "bg-sky",
    chip: "text-sky bg-sky/10 border-sky/30",
    dot: "bg-sky",
    solid: "#62a8e8",
  },
  cyan: {
    key: "color.cyan",
    swatch: "bg-cyan",
    bar: "bg-cyan",
    chip: "text-cyan bg-cyan/10 border-cyan/30",
    dot: "bg-cyan",
    solid: "#4fc4c4",
  },
  rose: {
    key: "color.rose",
    swatch: "bg-rose",
    bar: "bg-rose",
    chip: "text-rose bg-rose/10 border-rose/30",
    dot: "bg-rose",
    solid: "#d9708f",
  },
};

export const TEAM_COLOR_KEYS: TeamColor[] = ["amber", "coral", "mint", "sky", "cyan", "rose"];

export const TASK_STATUS_KEY: Record<"todo" | "active" | "done", string> = {
  todo: "taskStatus.todo",
  active: "taskStatus.active",
  done: "taskStatus.done",
};
