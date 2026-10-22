import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { IconRefresh, IconX } from "./icons";

interface UndoableAction {
  id: number;
  label: string;
  restore: () => void;
  expiresAt: number;
}

interface UndoCtx {
  pushUndo: (label: string, restore: () => void) => void;
}

const Ctx = createContext<UndoCtx | null>(null);
const UNDO_WINDOW_MS = 8000; // 8 seconds to undo

export function UndoProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<UndoableAction[]>([]);
  const nextId = useRef(1);

  const pushUndo = useCallback((label: string, restore: () => void) => {
    const id = nextId.current++;
    setActions((prev) => [
      ...prev,
      { id, label, restore, expiresAt: Date.now() + UNDO_WINDOW_MS },
    ]);
  }, []);

  // Auto-dismiss expired actions
  useEffect(() => {
    if (actions.length === 0) return;
    const earliest = Math.min(...actions.map((a) => a.expiresAt));
    const timer = window.setTimeout(() => {
      const t = Date.now();
      setActions((prev) => prev.filter((a) => a.expiresAt > t));
    }, Math.max(0, earliest - Date.now()));
    return () => window.clearTimeout(timer);
  }, [actions]);

  const undo = (id: number) => {
    const action = actions.find((a) => a.id === id);
    if (action) {
      action.restore();
      setActions((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const dismiss = (id: number) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <Ctx.Provider value={{ pushUndo }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 items-center pointer-events-none">
        {actions.map((a) => (
          <UndoToast key={a.id} action={a} onUndo={undo} onDismiss={dismiss} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function UndoToast({
  action,
  onUndo,
  onDismiss,
}: {
  action: UndoableAction;
  onUndo: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const [remaining, setRemaining] = useState(UNDO_WINDOW_MS);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const left = Math.max(0, action.expiresAt - Date.now());
      setRemaining(left);
      if (left === 0) onDismiss(action.id);
    }, 100);
    return () => window.clearInterval(tick);
  }, [action, onDismiss]);

  const progress = (remaining / UNDO_WINDOW_MS) * 100;

  return (
    <div className="toast-in pointer-events-auto flex items-center gap-3 rounded-lg border border-amber/40 bg-panel2 px-4 py-3 shadow-2xl shadow-black/50 min-w-[320px] max-w-[480px]">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink">{action.label}</p>
        <div className="mt-2 h-0.5 w-full bg-line rounded-full overflow-hidden">
          <div
            className="h-full bg-amber transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <button
        onClick={() => onUndo(action.id)}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber/15 border border-amber/40 px-3 py-1.5 text-xs font-semibold text-amber hover:bg-amber/25 transition-colors shrink-0"
      >
        <IconRefresh className="w-3.5 h-3.5" />
        Undo
      </button>
      <button
        onClick={() => onDismiss(action.id)}
        className="text-dim hover:text-ink transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <IconX className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useUndo() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUndo must be used inside UndoProvider");
  return ctx;
}
