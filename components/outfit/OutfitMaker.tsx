"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { GarmentPhoto } from "@/components/garment/GarmentPhoto";
import { BodyFields, useBodyDraft } from "./BodyEditor";
import { Mannequin, type Worn } from "./Mannequin";
import { CheckIcon, PlusIcon, SmallCloseIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { CATEGORY_LABEL, type Category, type Outfit, type OutfitSlot, SLOT_LABEL, slotOf } from "@/lib/types";

/** 캔버스 칸 순서 (outfit_autumn.html: 아우터 · 하의 / 상의 · 신발, 그 아래에 모자 · 가방·기타) */
export const CANVAS_SLOTS: OutfitSlot[] = ["outer", "bottom", "top", "shoes", "hat", "etc"];
const PICK_CATEGORIES: Category[] = ["top", "bottom", "outer", "shoes", "etc"];
const WORN_SLOTS = ["outer", "top", "bottom", "shoes", "hat", "etc"] as const;

const inputCls =
  "h-[46px] w-full rounded-[14px] border border-line bg-card px-3.5 text-base outline-none placeholder:text-muted focus:border-primary";

export interface OutfitDraft {
  name: string;
  memo: string;
  slots: Outfit["slots"];
}

export const EMPTY_DRAFT: OutfitDraft = { name: "", memo: "", slots: {} };

/** 코디 만들기: 고정 슬롯 2×2 + 내 옷장에서 고르기 + 이름·메모 (outfit_autumn.html) */
export function OutfitMaker({
  draft,
  onChange,
  nameError,
}: {
  draft: OutfitDraft;
  onChange: (d: OutfitDraft) => void;
  nameError: boolean;
}) {
  const { garments, profile } = useData();
  const [cat, setCat] = useState<Category | "all">("all");
  /** 마네킹으로 입어 보기(기본) / 칸으로 보기(목업) */
  const [view, setView] = useState<"slots" | "mannequin">("mannequin");
  const bodyDraft = useBodyDraft();

  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments]);
  const pickable = garments.filter((g) => cat === "all" || g.category === cat);
  const chosen = new Set(Object.values(draft.slots));

  const setSlot = (slot: OutfitSlot, id: string | undefined) => {
    const slots = { ...draft.slots };
    if (id) slots[slot] = id;
    else delete slots[slot];
    onChange({ ...draft, slots });
  };

  const worn: Worn = {};
  for (const slot of WORN_SLOTS) {
    const g = draft.slots[slot] ? byId.get(draft.slots[slot]!) : undefined;
    if (g) worn[slot] = g;
  }
  // 입력하는 동안에는 입력 중인 값으로 마네킹을 바로 바꿔 보여 준다
  const body = bodyDraft.touched || bodyDraft.saved ? bodyDraft.preview : profile.body;

  return (
    <>
      {view === "mannequin" && (
        <div className="mx-4 mt-2.5 rounded-card-lg border border-line bg-card pt-3 pb-3.5">
          <div className="flex justify-center">
            <Mannequin body={body} worn={worn} height={330} />
          </div>
          <div className="mt-2 px-4">
            <BodyFields draft={bodyDraft} />
          </div>
        </div>
      )}
      <div
        className={
          "mx-4 mt-2.5 grid grid-cols-2 gap-2.5 rounded-card-lg border border-line bg-card p-2.5 " +
          (view === "mannequin" ? "hidden" : "")
        }
      >
        {CANVAS_SLOTS.map((slot) => {
          const g = draft.slots[slot] ? byId.get(draft.slots[slot]!) : undefined;
          return (
            <div key={slot} className="relative flex h-[116px] items-center justify-center rounded-[14px] bg-tile">
              <em className="absolute top-2 left-2.5 text-xs text-sub not-italic">{SLOT_LABEL[slot]}</em>
              {g ? (
                <>
                  <button
                    type="button"
                    aria-label={`${SLOT_LABEL[slot]}에서 빼기`}
                    className="absolute top-[5px] right-1.5 flex size-[22px] items-center justify-center rounded-full border border-line bg-white text-sub"
                    onClick={() => setSlot(slot, undefined)}
                  >
                    <SmallCloseIcon />
                  </button>
                  <GarmentPhoto src={g.photoUrl} alt={g.name} size={78} />
                </>
              ) : (
                <span className="text-muted" aria-hidden>
                  <PlusIcon size={22} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between px-5 pt-3.5">
        <h2 className="text-[15px] font-semibold">내 옷장에서 고르기</h2>
        <button
          type="button"
          className="text-[13px] font-semibold text-deep"
          onClick={() => setView((v) => (v === "slots" ? "mannequin" : "slots"))}
        >
          {view === "slots" ? "마네킹으로 보기" : "칸으로 보기"}
        </button>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-2">
        <Chip selected={cat === "all"} onClick={() => setCat("all")}>
          전체
        </Chip>
        {PICK_CATEGORIES.map((c) => (
          <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>
      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-2">
        {pickable.map((g) => {
          const on = chosen.has(g.id);
          const slot = slotOf(g);
          return (
            <li key={g.id} className="flex-none">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setSlot(slot, on ? undefined : g.id)}
                className={
                  "relative w-[84px] rounded-[14px] bg-card text-center " +
                  (on ? "border-2 border-primary px-1 pt-1 pb-[7px]" : "border border-line px-[5px] pt-[5px] pb-2")
                }
              >
                <span className={"flex h-[68px] items-center justify-center rounded-[10px] " + (on ? "bg-soft" : "bg-tile")}>
                  <GarmentPhoto src={g.photoUrl} alt="" size={54} />
                </span>
                {on && (
                  <span className="absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-primary text-on">
                    <CheckIcon size={12} stroke={2.6} />
                  </span>
                )}
                <span className="mx-0.5 mt-[5px] block truncate text-xs font-medium">{g.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="px-5 pt-3">
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="코디 이름"
          aria-label="코디 이름"
          aria-invalid={nameError}
          className={inputCls + (nameError ? " border-deep" : "")}
        />
        {nameError && <p className="mt-1.5 text-[13px] text-deep">코디 이름을 입력해 주세요.</p>}
      </div>
      <div className="px-5 pt-2 pb-4">
        <input
          value={draft.memo}
          onChange={(e) => onChange({ ...draft, memo: e.target.value })}
          placeholder="메모 (선택)"
          aria-label="메모"
          className={inputCls}
        />
      </div>
    </>
  );
}

/** 옷이 2벌보다 적을 때 */
export function NotEnoughGarments() {
  return (
    <EmptyState
      action={
        <Link href="/closet" className={buttonClass()}>
          내 옷장으로
        </Link>
      }
    >
      코디를 만들려면 옷이 2벌 이상 필요해요.
    </EmptyState>
  );
}
