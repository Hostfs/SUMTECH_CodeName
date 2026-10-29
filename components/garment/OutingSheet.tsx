"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { OUTING_LABEL, OUTING_PLACE_NAME } from "@/lib/outing";
import type { OutingInput } from "@/lib/repo";
import type { OutingKind } from "@/lib/types";

const inputCls =
  "h-[46px] w-full rounded-[14px] border border-line bg-card px-3.5 text-base outline-none placeholder:text-muted focus:border-primary";

function Label({ htmlFor, children, optional = true }: { htmlFor?: string; children: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mt-4 mb-[7px] flex justify-between text-sm font-semibold first:mt-0">
      {children}
      {optional && <span className="text-[13px] font-normal text-sub">선택</span>}
    </label>
  );
}

/** 세탁·수선 맡기기 시트 (목업 없음). 맡긴 곳·날짜·메모는 모두 선택이다. */
export function OutingSheet({
  open,
  onClose,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  /** 이미 맡긴 옷의 정보를 고칠 때 */
  initial?: OutingInput;
  onSubmit: (input: OutingInput) => void;
}) {
  const [kind, setKind] = useState<OutingKind>("laundry");
  const [shop, setShop] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? "laundry");
    setShop(initial?.shop ?? "");
    setDueDate(initial?.dueDate ?? "");
    setMemo(initial?.memo ?? "");
    // initial은 열 때만 읽는다 (입력 중에 부모가 다시 그려도 값이 덮이지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = () =>
    onSubmit({
      kind,
      shop: shop.trim() || undefined,
      dueDate: dueDate || undefined,
      memo: memo.trim() || undefined,
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? "맡김 정보 수정" : "세탁·수선 맡기기"}
      footer={
        <Button size="lg" className="w-full" onClick={submit}>
          {initial ? "저장" : "맡기기"}
        </Button>
      }
    >
      <form
        className="px-5 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Label optional={false}>무엇을 맡기나요?</Label>
        <div className="flex gap-2">
          {(["laundry", "repair"] as const).map((k) => (
            <Chip key={k} selected={kind === k} className="flex-1 justify-center" onClick={() => setKind(k)}>
              {OUTING_LABEL[k]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-sub">맡긴 동안 보관 위치가 &apos;{OUTING_PLACE_NAME[kind]}&apos;로 바뀌어요.</p>

        <Label htmlFor="outing-shop">맡긴 곳</Label>
        <input
          id="outing-shop"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="예: 우리동네세탁소"
          className={inputCls}
        />

        <Label htmlFor="outing-due">찾을 날짜</Label>
        <input id="outing-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
        <p className="mt-1.5 text-[13px] text-sub">날짜를 정하면 찾을 때가 됐을 때 알려 드려요.</p>

        <Label htmlFor="outing-memo">메모</Label>
        <input
          id="outing-memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 소매 얼룩 제거"
          className={inputCls}
        />
      </form>
    </Sheet>
  );
}
