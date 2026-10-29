"use client";

import { useEffect } from "react";

/**
 * 바텀시트 (목업 없음, 같은 디자인 시스템으로 설계).
 * 화면(Screen) 안에 그려서 아이폰 프레임 밖으로 나가지 않게 한다.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={
        "absolute inset-0 z-[45] transition-[visibility] duration-200 " + (open ? "visible" : "invisible delay-200")
      }
      aria-hidden={!open}
      inert={!open}
    >
      <div
        className={"absolute inset-0 bg-[#1D1D1F]/30 transition-opacity duration-200 " + (open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          "absolute inset-x-0 bottom-0 flex max-h-[78%] flex-col rounded-t-[22px] bg-card transition-transform duration-200 ease-out " +
          (open ? "translate-y-0" : "translate-y-full")
        }
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line" />
        <h2 className="shrink-0 px-5 pt-3.5 pb-2 text-[17px] font-semibold">{title}</h2>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-4 pt-3 pb-[max(30px,env(safe-area-inset-bottom))]">{footer}</div>}
        {!footer && <div className="h-6 shrink-0" />}
      </div>
    </div>
  );
}
