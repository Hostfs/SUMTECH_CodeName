"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { rootPlaces } from "@/lib/places";
import type { Place } from "@/lib/types";

const inputCls =
  "h-[46px] w-full rounded-[14px] border border-line bg-card px-3.5 text-base outline-none placeholder:text-muted focus:border-primary";

/**
 * 장소 추가 / 이름 수정 시트 (목업 없음).
 * 추가할 때는 '어디 안에 있나요?'로 하위 칸(옷장 A › 서랍 4)을 만들 수 있다. 1단계 하위까지만.
 */
export function PlaceEditSheet({
  open,
  onClose,
  editing,
  defaultParentId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** 있으면 이름 수정, 없으면 추가 */
  editing?: Place;
  defaultParentId?: string | null;
  onSaved: (place: Place, mode: "create" | "rename") => void;
}) {
  const { places, createPlace, renamePlace } = useData();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setParentId(editing ? "" : (defaultParentId ?? ""));
    setMemo("");
    setError(false);
    const t = setTimeout(() => nameRef.current?.focus(), 220);
    return () => clearTimeout(t);
  }, [open, editing, defaultParentId]);

  const save = async () => {
    const n = name.trim();
    if (!n) {
      setError(true);
      nameRef.current?.focus();
      return;
    }
    if (editing) {
      await renamePlace(editing.id, n);
      onSaved({ ...editing, name: n }, "rename");
    } else {
      const p = await createPlace({ name: n, parentId: parentId || null, memo: memo.trim() || undefined });
      onSaved(p, "create");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "이름 수정" : "장소 추가"}
      footer={
        <Button size="lg" className="w-full" onClick={save}>
          {editing ? "저장" : "추가"}
        </Button>
      }
    >
      <form
        className="px-5 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor="place-name" className="mb-[7px] block text-sm font-semibold">
          이름
        </label>
        <input
          id="place-name"
          ref={nameRef}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) setError(false);
          }}
          placeholder="예: 옷장 C, 서랍 4"
          aria-invalid={error}
          className={inputCls + (error ? " border-deep" : "")}
        />
        {error && <p className="mt-1.5 text-[13px] text-deep">이름을 입력해 주세요.</p>}

        {!editing && (
          <>
            <label htmlFor="place-parent" className="mt-4 mb-[7px] flex justify-between text-sm font-semibold">
              어디 안에 있나요?
              <span className="text-[13px] font-normal text-sub">선택</span>
            </label>
            <select id="place-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputCls}>
              <option value="">따로 있는 장소</option>
              {rootPlaces(places).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} 안
                </option>
              ))}
            </select>
            {!parentId && (
              <>
                <label htmlFor="place-memo" className="mt-4 mb-[7px] flex justify-between text-sm font-semibold">
                  메모
                  <span className="text-[13px] font-normal text-sub">선택</span>
                </label>
                <input
                  id="place-memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="예: 니트·이불류"
                  className={inputCls}
                />
              </>
            )}
          </>
        )}
      </form>
    </Sheet>
  );
}
