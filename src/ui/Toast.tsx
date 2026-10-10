import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import './Toast.css';

interface ToastData {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

type Show = (message: string, action?: { label: string; run: () => void }) => void;

const ToastContext = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback<Show>((message, action) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, actionLabel: action?.label, onAction: action?.run });
    timer.current = window.setTimeout(() => setToast(null), action ? 6000 : 3000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span className="toast__msg">{toast.message}</span>
            {toast.onAction && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  return useContext(ToastContext);
}
