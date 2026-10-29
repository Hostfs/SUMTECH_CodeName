"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { OutfitCard } from "@/components/outfit/OutfitCard";
import { EMPTY_DRAFT, NotEnoughGarments, OutfitMaker, type OutfitDraft } from "@/components/outfit/OutfitMaker";
import { Screen } from "@/components/layout/Screen";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

type Tab = "make" | "saved";

export default function OutfitsPage() {
  const { garments, outfits, createOutfit } = useData();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("make");
  const [draft, setDraft] = useState<OutfitDraft>(EMPTY_DRAFT);
  const [nameError, setNameError] = useState(false);

  // 마이 > 저장한 코디에서 들어오면 ?tab=saved
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "saved") setTab("saved");
  }, []);

  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments]);
  const itemCount = Object.keys(draft.slots).length;
  const canMake = garments.filter((g) => g.category !== "etc").length >= 2;

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
      bottomBar={
        tab === "make" && canMake ? (
          <Button size="lg" className="flex-1" disabled={itemCount === 0} onClick={save}>
            코디 저장
          </Button>
        ) : undefined
      }
    >
      <TopBar title="코디" fallbackHref="/" />

      <div className="mx-4 mt-1.5 flex h-[42px] rounded-full bg-[#ECEAE5] p-1" role="tablist">
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

      {tab === "make" ? (
        canMake ? (
          <OutfitMaker
            draft={draft}
            onChange={(d) => {
              setDraft(d);
              if (d.name.trim()) setNameError(false);
            }}
            nameError={nameError}
          />
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
    </Screen>
  );
}
