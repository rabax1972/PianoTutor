import { create } from 'zustand';
import './progress.css';

export interface Toast {
  id: number;
  icon: string;
  title: string;
  text?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function pushToast(t: Omit<Toast, 'id'>): void {
  useToasts.getState().push(t);
}

/** Notifiche a comparsa (badge, obiettivi), sempre visibili sopra l'app. */
export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="toaster" aria-live="polite" role="status">
      {toasts.map((t) => (
        <button key={t.id} className="toast" onClick={() => dismiss(t.id)} data-testid="toast">
          <span className="toast__icon" aria-hidden>
            {t.icon}
          </span>
          <span>
            <strong>{t.title}</strong>
            {t.text && <span className="toast__text">{t.text}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
