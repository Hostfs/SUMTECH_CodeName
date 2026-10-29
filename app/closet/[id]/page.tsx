"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { GarmentPhoto } from "@/components/garment/GarmentPhoto";
import { PlacePickerSheet } from "@/components/garment/PlacePickerSheet";
import { CameraIcon, MoreIcon, PinIcon } from "@/components/icons";
import { Screen } from "@/components/layout/Screen";
import { TopBar } from "@/components/layout/TopBar";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { movedMessage, placePath, UNASSIGNED_LABEL } from "@/lib/places";
import { SEASON_LABEL, SEASONS } from "@/lib/theme";
import { CATEGORY_LABEL } from "@/lib/types";

export default function GarmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { ready, garments, placeIndex, updateGarment, removeGarment } = useData();
  const [moveOpen, setMoveOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const g = garments.find((x) => x.id === id);

  if (!g) {
    return (
      <Screen>
        <TopBar title="옷 정보" />
        {ready && (
          <p className="px-5 pt-10 text-center text-sm leading-relaxed text-sub">
            옷 정보를 찾지 못했어요.
            <br />
            <Link href="/closet" className="font-semibold text-deep">
              내 옷장으로
            </Link>
          </p>
        )}
      </Screen>
    );
  }

  const location = placePath(placeIndex, g.placeId, " › ");

  const move = async (placeId: string | null) => {
    await updateGarment(g.id, { placeId });
    setMoveOpen(false);
    toast(movedMessage(placeIndex, placeId));
  };

  const remove = async () => {
    setConfirmOpen(false);
    router.replace("/closet");
    await removeGarment(g.id);
    toast("삭제했어요");
  };

  const info: [string, string | undefined][] = [
    ["종류", CATEGORY_LABEL[g.category]],
    ["색상", g.color || undefined],
    ["브랜드", g.brand],
    ["사이즈", g.size],
    ["소재", g.material],
    ["메모", g.memo],
  ];

  return (
    <Screen
      bottomBar={
        <>
          <Button size="lg" className="flex-[1.5]" onClick={() => setMoveOpen(true)}>
            위치 변경
          </Button>
          <Link href={`/closet/${g.id}/edit`} className={buttonClass("outline", "lg") + " flex-1"}>
            수정
          </Link>
          <Button variant="ghost" size="lg" onClick={() => setConfirmOpen(true)}>
            삭제
          </Button>
        </>
      }
    >
      <TopBar
        title="옷 정보"
        right={
          <div className="relative">
            <button
              type="button"
              aria-label="더 보기"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex size-11 items-center justify-center"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreIcon />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <ul role="menu" className="absolute top-11 right-0 z-20 w-32 overflow-hidden rounded-[14px] border border-line bg-card">
                  <li>
                    <Link role="menuitem" href={`/closet/${g.id}/edit`} className="flex h-11 items-center px-4 text-sm">
                      수정
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      role="menuitem"
                      className="h-11 w-full px-4 text-left text-sm"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmOpen(true);
                      }}
                    >
                      삭제
                    </button>
                  </li>
                </ul>
              </>
            )}
          </div>
        }
      />

      <div className="mx-4 mt-1.5 flex h-[216px] items-center justify-center rounded-card-lg border border-line bg-card">
        <div className="flex h-[196px] w-[calc(100%-20px)] items-center justify-center rounded-[14px] bg-tile">
          <GarmentPhoto src={g.photoUrl} alt={g.name} size={176} />
        </div>
      </div>

      <h2 className="px-5 pt-3.5 text-[22px] font-semibold tracking-[-0.02em]">{g.name}</h2>
      {g.seasons.length > 0 && (
        <div className="flex gap-1.5 px-5 pt-2">
          {SEASONS.filter((s) => g.seasons.includes(s)).map((s) => (
            <span key={s} className="flex h-[26px] items-center rounded-full bg-soft px-[11px] text-[13px] font-semibold text-deep">
              {SEASON_LABEL[s]}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        className="mx-4 mt-3 flex w-[calc(100%-32px)] items-center gap-3.5 rounded-card-lg bg-soft px-4 py-3.5 text-left"
        onClick={() => setMoveOpen(true)}
      >
        <span className="flex size-11 flex-none items-center justify-center rounded-full bg-primary text-on">
          <PinIcon size={22} />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] text-sub">보관 위치</span>
          <span className={"mt-0.5 block text-xl font-bold tracking-[-0.02em] " + (location ? "" : "text-sub")}>
            {location ?? UNASSIGNED_LABEL}
          </span>
        </span>
      </button>

      <dl className="mx-4 mt-3 grid grid-cols-2 gap-x-3 rounded-card-lg border border-line bg-card px-4 py-1.5">
        {info.map(([k, v], i) => (
          <div
            key={k}
            className={"flex h-[34px] min-w-0 items-center gap-2.5 text-[14.5px] " + (i < info.length - 2 ? "border-b border-line" : "")}
          >
            <dt className="w-11 flex-none text-[13px] whitespace-nowrap text-sub">{k}</dt>
            <dd className={"truncate " + (v ? "" : "text-muted")}>{v ?? "미입력"}</dd>
          </div>
        ))}
      </dl>

      <h3 className="px-5 pt-3.5 text-base font-semibold">세탁·관리 정보</h3>
      {g.careInfo && g.careInfo.length > 0 ? (
        <ul className="mx-4 mt-2 rounded-card-lg border border-line bg-card px-4 py-2 text-sm">
          {g.careInfo.map((c, i) => (
            <li key={i} className="py-1.5">
              {c.text}
              {!c.confirmed && <span className="ml-2 text-xs text-deep">확인 필요</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mx-4 mt-2 mb-4 flex items-center gap-3 rounded-card-lg border border-dashed border-dash bg-white/60 px-3.5 py-3">
          <p className="flex-1 text-[13px] leading-normal text-sub">
            등록된 관리 정보가 없어요.
            <br />
            세탁 라벨을 촬영해 추가할 수 있어요.
          </p>
          <button
            type="button"
            className="flex h-[38px] flex-none items-center gap-1 rounded-full border border-primary bg-card px-3.5 text-[13.5px] font-semibold text-deep"
            onClick={() => toast("라벨 인식은 준비 중이에요")}
          >
            <CameraIcon />
            라벨 촬영
          </button>
        </div>
      )}

      <PlacePickerSheet open={moveOpen} onClose={() => setMoveOpen(false)} current={g.placeId} onConfirm={move} />
      <ConfirmDialog
        open={confirmOpen}
        message={
          <>
            정말 삭제할까요?
            <br />
            코디에서도 빠져요.
          </>
        }
        confirmLabel="삭제"
        onConfirm={remove}
        onClose={() => setConfirmOpen(false)}
      />
    </Screen>
  );
}
