"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type NotificationType = "success" | "error";
type Notification = { id: number; type: NotificationType; message: string; visible: boolean };
const NotificationContext = createContext<{
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
} | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const sequence = useRef(0);
  const showSuccess = useCallback((message: string) => {
    setNotification({ id: ++sequence.current, type: "success", message, visible: true });
  }, []);

  const showError = useCallback((message: string) => {
    setNotification({ id: ++sequence.current, type: "error", message, visible: true });
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
    <NotificationContext.Provider value={{ showSuccess, showError }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed left-4 right-4 top-20 z-[100] sm:left-auto sm:right-6 sm:max-w-sm"
      >
        {notification && (
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm transition-all duration-300 motion-reduce:transition-none ${notification.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 font-medium"
                : "border-red-200 bg-red-50 text-red-900 font-medium"
              } ${notification.visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}
          >
            {notification.type === "success" ? (
              <CheckCircle2
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-emerald-600"
              />
            ) : (
              <AlertCircle
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-red-600"
              />
            )}
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
