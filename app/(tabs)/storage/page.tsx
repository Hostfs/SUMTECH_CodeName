"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { ChevronRightIcon, PinIcon, PlusIcon } from "@/components/icons";
import { Screen } from "@/components/layout/Screen";
import { PlaceEditSheet } from "@/components/storage/PlaceEditSheet";
import { PlaceThumbs } from "@/components/storage/PlaceThumbs";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { childSummary, countLabel, garmentsInPlace, rootPlaces } from "@/lib/places";
import { placeHref } from "@/lib/routes";

export default function StoragePage() {
  const { garments, places } = useData();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const placed = garments.filter((g) => g.placeId).length;
  const unassigned = garments.length - placed;
  const pct = garments.length ? Math.round((placed / garments.length) * 100) : 0;

  return (
    <Screen withTabBar>
      <div className="flex h-[52px] items-center justify-between px-5 pt-2">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">보관함</h1>
        <Button size="sm" className="gap-1 text-[13.5px]" onClick={() => setAddOpen(true)}>
          <PlusIcon size={16} stroke={2} />
          장소 추가
        </Button>
      </div>

      {garments.length > 0 && (
        <div className="mx-4 mt-2.5 rounded-card-lg bg-soft px-4 py-3.5">
          <b className="text-[15px] font-semibold tracking-[-0.02em]">
            옷 {garments.length}벌 중 {placed}벌의 위치가 정해져 있어요
          </b>
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[13px] font-bold text-deep">{pct}%</span>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2 px-4 pt-3 pb-4">
        {rootPlaces(places).map((p) => {
          const inside = garmentsInPlace(garments, places, p.id);
          const sub = [p.memo ?? childSummary(places, p.id), countLabel(inside)].filter(Boolean).join(" · ");
          return (
            <li key={p.id}>
              <Link
                href={placeHref(p.id)}
                className="flex h-[76px] items-center gap-3 rounded-card border border-line bg-card pr-3.5 pl-3"
              >
                <PlaceThumbs garments={inside} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-base font-semibold tracking-[-0.02em]">{p.name}</b>
                  <span className="mt-0.5 block truncate text-caption text-sub">{sub}</span>
                </span>
                <ChevronRightIcon size={20} className="text-[#A9A69F]" />
              </Link>
            </li>
          );
        })}

        {unassigned > 0 && (
          <li>
            <Link
              href="/closet?place=none"
              className="flex h-[76px] items-center gap-3 rounded-card border border-dashed border-dash bg-white/60 pr-3.5 pl-3"
            >
              <span className="flex size-[42px] flex-none items-center justify-center rounded-xl bg-nobadge text-sub">
                <PinIcon size={22} stroke={1.6} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-base font-semibold tracking-[-0.02em]">위치 미지정</b>
                <span className="mt-0.5 block text-caption text-sub">{unassigned}벌 · 위치를 정해 주세요</span>
              </span>
              <span className="flex h-[26px] items-center rounded-full bg-soft px-2.5 text-caption font-semibold text-deep">
                정하기
              </span>
            </Link>
          </li>
        )}
      </ul>

      <PlaceEditSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          toast("장소를 추가했어요");
        }}
      />
    </Screen>
  );
}
