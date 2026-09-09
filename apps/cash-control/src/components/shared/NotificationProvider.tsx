"use client";

import { CheckCircle2 } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type Notification = { id: number; message: string; visible: boolean };
const NotificationContext = createContext<{
  showSuccess: (message: string) => void;
} | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const sequence = useRef(0);
  const showSuccess = useCallback((message: string) => {
    setNotification({ id: ++sequence.current, message, visible: true });
  }, []);
  const notificationId = notification?.id;
  useEffect(() => {
    if (notificationId === undefined) return;
    const fade = setTimeout(
      () =>
        setNotification((current) =>
          current?.id === notificationId
            ? { ...current, visible: false }
            : current,
        ),
      2700,
    );
    const dismiss = setTimeout(
      () =>
        setNotification((current) =>
          current?.id === notificationId ? null : current,
        ),
      3000,
    );
    return () => {
      clearTimeout(fade);
      clearTimeout(dismiss);
    };
  }, [notificationId]);
  return (
    <NotificationContext.Provider value={{ showSuccess }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed left-4 right-4 top-20 z-[100] sm:left-auto sm:right-6 sm:max-w-sm"
      >
        {notification && (
          <div
            className={`flex items-start gap-3 rounded-xl border border-[#334155] bg-[#0F172A] px-4 py-3 text-sm text-white shadow-md transition-all duration-300 motion-reduce:transition-none ${notification.visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}
          >
            <CheckCircle2
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-emerald-600"
            />
            <p>{notification.message}</p>
          </div>
        )}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error("useNotification must be used within NotificationProvider");
  return context;
}
