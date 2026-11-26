import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { strings } from "@/pages/resolver/i18n";

interface ToastItem {
  id: number;
  text: string;
}

const ToastContext = createContext<(text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (text: string) => {
      const id = next.current++;
      setItems((all) => [...all.slice(-2), { id, text }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.text}</span>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              style={{ color: "#fff" }}
              onClick={() => dismiss(t.id)}
            >
              {strings.common.close}
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (text: string) => void {
  return useContext(ToastContext);
}
