"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { Screen } from "@/components/layout/Screen";
import { OutfitCard } from "@/components/outfit/OutfitCard";
import { EMPTY_DRAFT, NotEnoughGarments, OutfitMaker, type OutfitDraft } from "@/components/outfit/OutfitMaker";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useSessionState } from "@/lib/useSessionState";

type Tab = "make" | "saved";

/** 코디 탭: 마네킹에 입혀 보고(키·몸무게 입력 포함), 저장한 코디를 모아 본다 */
export default function OutfitsPage() {
  const { garments, outfits, createOutfit } = useData();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("make");
  // 다른 탭에 다녀와도 작성 중인 코디가 남도록 세션에 보관한다
  const [draft, setDraft] = useSessionState<OutfitDraft>("outfit.draft", EMPTY_DRAFT);
  const [nameError, setNameError] = useState(false);

  // 프로필 > 저장한 코디에서 들어오면 ?tab=saved
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "saved") setTab("saved");
  }, []);

  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments]);
  const itemCount = Object.keys(draft.slots).length;
  const canMake = garments.filter((g) => g.category !== "etc").length >= 2;
  const showSave = tab === "make" && canMake;

  const save = async () => {
    if (!draft.name.trim()) {
      setNameError(true);
      return;
    }
    await createOutfit({ name: draft.name.trim(), memo: draft.memo.trim() || undefined, slots: draft.slots });
    setDraft(EMPTY_DRAFT);
    setNameError(false);
    setTab("saved");
    toast("코디를 저장했어요");
  };

  return (
    <Screen
      withTabBar
      header={
        <>
          <div className="flex h-12 items-center px-5 pt-1.5">
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">코디</h1>
          </div>
          <div className="mx-4 mt-1 flex h-[42px] rounded-full bg-[#ECEAE5] p-1" role="tablist">
            {(
              [
                ["make", "만들기"],
                ["saved", "저장한 코디"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={
                  "flex flex-1 items-center justify-center rounded-full text-[14.5px] " +
                  (tab === key ? "bg-primary font-semibold text-on" : "text-sub")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </>
      }
    >
      {tab === "make" ? (
        canMake ? (
          <div className="pb-[84px]">
            <OutfitMaker
              draft={draft}
              onChange={(d) => {
                setDraft(d);
                if (d.name.trim()) setNameError(false);
              }}
              nameError={nameError}
            />
          </div>
        ) : (
          <NotEnoughGarments />
        )
      ) : outfits.length === 0 ? (
        <EmptyState action={<Button onClick={() => setTab("make")}>코디 만들기</Button>}>
          아직 저장한 코디가 없어요.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2 px-4 pt-3 pb-6">
          {outfits.map((o) => (
            <li key={o.id}>
              <OutfitCard outfit={o} byId={byId} />
            </li>
          ))}
        </ul>
      )}

      {showSave && (
        <div className="absolute inset-x-4 bottom-[calc(var(--tabbar-h)+10px)] z-30">
          <Button size="lg" className="w-full" disabled={itemCount === 0} onClick={save}>
            코디 저장
          </Button>
        </div>
      )}
    </Screen>
  );
}
