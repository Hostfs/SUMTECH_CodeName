"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** 짧은 완료 안내. 예: "등록했어요", "코디를 저장했어요" (design-system 5절) */

type Show = (message: string, opts?: { error?: boolean }) => void;

const ToastContext = createContext<Show | null>(null);
const ToastStateContext = createContext<{ message: string; key: number } | null>(null);

const SHOW_MS = 2400;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  // 오류 안내는 떠 있는 동안 뒤이은 완료 안내에 덮이지 않게 한다
  const errorUntil = useRef(0);
  const show = useCallback<Show>((message, opts) => {
    const now = Date.now();
    if (!opts?.error && now < errorUntil.current) return;
    if (opts?.error) errorUntil.current = now + SHOW_MS;
    setToast({ message, key: now });
  }, []);
  return (
    <ToastContext.Provider value={show}>
      <ToastStateContext.Provider value={toast}>{children}</ToastStateContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside ToastProvider");
  return show;
}

/** 아이폰 화면 안, 탭 바 바로 위에 뜬다. PhoneFrame 안에 한 번 둔다. */
export function ToastViewport() {
  const toast = useContext(ToastStateContext);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer.current);
  }, [toast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-4 bottom-[calc(var(--tabbar-h)+16px)] z-[55] flex justify-center"
    >
      {toast && (
        <div
          className={
            "max-w-full rounded-full bg-ink/92 px-5 py-3 text-center text-sm font-semibold text-white transition-all duration-200 " +
            (visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")
          }
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
