"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** 짧은 완료 안내. 예: "등록했어요", "코디를 저장했어요" (design-system 5절) */

const ToastContext = createContext<((message: string) => void) | null>(null);
const ToastStateContext = createContext<{ message: string; key: number } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  const show = useCallback((message: string) => setToast({ message, key: Date.now() }), []);
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
    timer.current = setTimeout(() => setVisible(false), 2400);
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
