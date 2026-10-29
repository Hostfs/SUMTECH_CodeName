"use client";

import { useEffect } from "react";
import { Button } from "./Button";

/** 확인 창 (목업 없음). 문구는 문장마다 줄을 나눠서 넘긴다. */
export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[45] flex items-center justify-center px-8">
      <div className="absolute inset-0 bg-[#1D1D1F]/30" onClick={onClose} />
      <div role="alertdialog" aria-modal="true" className="relative w-full max-w-[320px] rounded-card-lg bg-card px-5 pt-6 pb-4">
        <p className="text-center text-[15px] leading-normal">{message}</p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            취소
          </Button>
          <Button className="flex-1" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
