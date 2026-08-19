import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { StatusKey, TaskStatus } from "./types";
import { STATUS_META, TASK_STATUS_KEY } from "./meta";
import { IconCheck, IconTrash, IconX } from "./icons";
import { useI18n } from "./i18n";

/* ---------- class recipes ---------- */

export const panelCls = "bg-panel border border-line rounded-xl";

export const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-mint text-[#0b130e] font-semibold text-sm px-3.5 py-2 hover:bg-[#8adcae] active:scale-[0.98] transition-all duration-150";

export const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border border-line2 bg-transparent text-mut text-sm px-3.5 py-2 hover:text-ink hover:bg-panel2 active:scale-[0.98] transition-all duration-150";

export const btnIcon =
  "inline-flex items-center justify-center w-8 h-8 rounded-lg border border-line2 text-mut hover:text-ink hover:bg-panel2 hover:border-line2 active:scale-95 transition-all duration-150";

export const inputCls =
  "w-full bg-panel2 border border-line2 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-dim outline-none focus:border-mint/60 focus:ring-2 focus:ring-mint/15 transition disabled:cursor-not-allowed";

/* ---------- toasts ---------- */

interface ToastItem {
  id: number;
  msg: string;
  tone: "ok" | "warn";
}

const ToastCtx = createContext<{ push: (msg: string, tone?: "ok" | "warn") => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((msg: string, tone: "ok" | "warn" = "ok") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, msg, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm shadow-xl shadow-black/40 bg-panel2 ${
              t.tone === "ok" ? "border-mint/40 text-ink" : "border-coral/40 text-ink"
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
                t.tone === "ok" ? "bg-mint/15 text-mint" : "bg-coral/15 text-coral"
              }`}
            >
              {t.tone === "ok" ? <IconCheck className="w-3 h-3" /> : <IconX className="w-3 h-3" />}
            </span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/65 fade-in" onClick={onClose} />
      <div
        className={`pop-in relative w-full ${wide ? "max-w-2xl" : "max-w-md"} bg-panel border border-line2 rounded-xl shadow-2xl shadow-black/60 max-h-[88vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line">
          <div>
            <h2 className="font-display font-semibold text-lg leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-mut mt-0.5">{subtitle}</p>}
          </div>
          <button className={btnIcon} onClick={onClose} aria-label={t("common.close")}>
            <IconX className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line bg-panel2/50 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- form primitives ---------- */

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-mut mb-1.5">
        {label}
      </span>
      {children}
      {error && <span className="block text-xs text-coral mt-1.5">{error}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} resize-none ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

/* ---------- display atoms ---------- */

export function Avatar({
  name,
  hue,
  size = 36,
  className = "",
}: {
  name: string;
  hue: number;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-display font-semibold shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `hsl(${hue} 36% 17%)`,
        color: `hsl(${hue} 62% 72%)`,
        border: `1px solid hsl(${hue} 38% 29%)`,
      }}
    >
      {initials}
    </span>
  );
}

export function Chip({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status, pulse = false }: { status: StatusKey; pulse?: boolean }) {
  const { t } = useI18n();
  const m = STATUS_META[status];
  return (
    <Chip className={m.chip}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${pulse && status === "available" ? "pulse-dot" : ""}`} />
      {t(m.key)}
    </Chip>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 reveal">
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-dashed border-line2 text-dim mb-4">
        {icon}
      </span>
      <p className="font-display font-semibold text-lg">{title}</p>
      <p className="text-sm text-mut mt-1 max-w-sm">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Delete control that arms on first click — no browser confirm() dialogs. */
export function DangerAction({
  onConfirm,
  label = "Delete",
  className = "",
}: {
  onConfirm: () => void;
  label?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 2600);
    return () => window.clearTimeout(timer);
  }, [armed]);

  if (armed) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setArmed(false);
          onConfirm();
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-coral/15 border border-coral/50 text-coral text-xs font-semibold px-2.5 py-1.5 hover:bg-coral/25 transition ${className}`}
      >
        <IconCheck className="w-3.5 h-3.5" /> {t("common.confirmDelete")}
      </button>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setArmed(true);
      }}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border border-line2 text-mut hover:text-coral hover:border-coral/50 hover:bg-coral/10 active:scale-95 transition-all duration-150 ${className}`}
    >
      <IconTrash className="w-4 h-4" />
    </button>
  );
}

/* ---------- segmented controls ---------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-line2 bg-panel2/60 p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
            value === o.value ? "bg-raise text-ink shadow-sm" : "text-mut hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SEG_ACTIVE: Record<TaskStatus, string> = {
  todo: "bg-sky/15 text-sky border-sky/40",
  active: "bg-amber/15 text-amber border-amber/40",
  done: "bg-mint/15 text-mint border-mint/40",
};

export function StatusSegments({
  value,
  onChange,
}: {
  value: TaskStatus;
  onChange: (s: TaskStatus) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="inline-flex rounded-lg border border-line2 overflow-hidden bg-panel2/60">
      {(["todo", "active", "done"] as TaskStatus[]).map((s) => (
        <button
          key={s}
          onClick={(e) => {
            e.stopPropagation();
            onChange(s);
          }}
          className={`px-2.5 py-1.5 text-xs font-semibold border-r border-line2 last:border-r-0 transition-all duration-150 ${
            value === s ? SEG_ACTIVE[s] : "text-dim hover:text-ink"
          }`}
        >
          {t(TASK_STATUS_KEY[s])}
        </button>
      ))}
    </div>
  );
}
