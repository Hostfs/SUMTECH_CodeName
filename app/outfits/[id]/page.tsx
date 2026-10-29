"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { GarmentPhoto } from "@/components/garment/GarmentPhoto";
import { PinIcon } from "@/components/icons";
import { Screen } from "@/components/layout/Screen";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { placePath } from "@/lib/places";
import { CATEGORY_LABEL, type Category, type OutfitSlot } from "@/lib/types";

const ORDER: OutfitSlot[] = ["outer", "top", "bottom", "shoes", "etc"];

/** 코디 상세 (목업 없음). 옷을 누르면 의류 상세로 간다. 편집은 3순위. */
export default function OutfitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { ready, outfits, garments, placeIndex, removeOutfit } = useData();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments]);
  const o = outfits.find((x) => x.id === id);

  if (!o) {
    return (
      <Screen>
        <TopBar title="코디" fallbackHref="/outfits" />
        {ready && <p className="px-5 pt-10 text-center text-sm text-sub">코디를 찾지 못했어요.</p>}
      </Screen>
    );
  }

  const items = ORDER.flatMap((slot) => {
    const g = o.slots[slot] ? byId.get(o.slots[slot]!) : undefined;
    return g ? [{ slot, g }] : [];
  });

  return (
    <Screen
      bottomBar={
        <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirmOpen(true)}>
          삭제
        </Button>
      }
    >
      <TopBar title={o.name} fallbackHref="/outfits" />
      {o.memo && <p className="px-5 pt-1 text-sm text-sub">{o.memo}</p>}

      <ul className="grid grid-cols-2 gap-3 px-4 pt-3 pb-6">
        {items.map(({ slot, g }) => {
          const loc = placePath(placeIndex, g.placeId);
          return (
            <li key={slot}>
              <Link href={`/closet/${g.id}`} className="block rounded-card border border-line bg-card px-2 pt-2 pb-3">
                <div className="relative flex h-32 items-center justify-center rounded-tile bg-tile">
                  <em className="absolute top-2 left-2.5 text-xs text-sub not-italic">{CATEGORY_LABEL[slot as Category]}</em>
                  <GarmentPhoto src={g.photoUrl} alt={g.name} size={96} />
                </div>
                <div className="mx-1 mt-[9px] truncate text-[15px] font-semibold">{g.name}</div>
                {loc ? (
                  <div className="mx-1 mt-[3px] flex items-center gap-[3px] text-caption whitespace-nowrap text-sub">
                    <PinIcon className="flex-none" />
                    <span className="truncate">{loc}</span>
                  </div>
                ) : (
                  <span className="mx-1 mt-[3px] inline-block rounded-full bg-nobadge px-[9px] py-0.5 text-xs text-sub">
                    위치 미지정
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={confirmOpen}
        message="이 코디를 삭제할까요?"
        confirmLabel="삭제"
        onConfirm={async () => {
          setConfirmOpen(false);
          router.replace("/outfits?tab=saved");
          await removeOutfit(o.id);
          toast("코디를 삭제했어요");
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </Screen>
  );
}
