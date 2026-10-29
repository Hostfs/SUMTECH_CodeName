"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { GarmentCard } from "@/components/garment/GarmentCard";
import { PlacePickerSheet } from "@/components/garment/PlacePickerSheet";
import { SelectionBar } from "@/components/garment/SelectionBar";
import { MoreIcon } from "@/components/icons";
import { Screen } from "@/components/layout/Screen";
import { TopBar } from "@/components/layout/TopBar";
import { PlaceEditSheet } from "@/components/storage/PlaceEditSheet";
import { Chip } from "@/components/ui/Chip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { childPlaces, countLabel, garmentsInPlace, movedMessage } from "@/lib/places";

/** 장소 상세 (목업 없음): 그 장소의 옷 그리드, 이름 수정, 옷 이동, 삭제 */
export default function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { ready, garments, places, placeIndex, moveGarments, removePlace } = useData();

  /** 하위 칸 칩. null = 전체 */
  const [scope, setScope] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const place = placeIndex.get(id);
  if (!place || place.parentId) {
    return (
      <Screen>
        <TopBar title="보관함" fallbackHref="/storage" />
        {ready && (
          <p className="px-5 pt-10 text-center text-sm leading-relaxed text-sub">
            장소를 찾지 못했어요.
            <br />
            <Link href="/storage" className="font-semibold text-deep">
              보관함으로
            </Link>
          </p>
        )}
      </Screen>
    );
  }

  const kids = childPlaces(places, place.id);
  const target = (scope && placeIndex.get(scope)) || place;
  const list = scope ? garments.filter((g) => g.placeId === scope) : garmentsInPlace(garments, places, place.id);

  const endSelecting = () => {
    setSelecting(false);
    setSelected([]);
  };

  const move = async (placeId: string | null) => {
    const n = selected.length;
    await moveGarments(selected, placeId);
    setMoveOpen(false);
    endSelecting();
    toast(movedMessage(placeIndex, placeId, n));
  };

  const remove = async () => {
    setConfirmOpen(false);
    if (target.id === place.id) router.replace("/storage");
    else setScope(null);
    await removePlace(target.id);
    toast("장소를 삭제했어요");
  };

  const removeCount = target.id === place.id ? garmentsInPlace(garments, places, place.id).length : list.length;

  return (
    <Screen>
      <TopBar
        title={place.name}
        fallbackHref="/storage"
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
                <ul role="menu" className="absolute top-11 right-0 z-20 w-36 overflow-hidden rounded-[14px] border border-line bg-card">
                  {[
                    { label: "이름 수정", run: () => setRenameOpen(true) },
                    { label: "장소 삭제", run: () => setConfirmOpen(true) },
                  ].map((m) => (
                    <li key={m.label}>
                      <button
                        type="button"
                        role="menuitem"
                        className="h-11 w-full px-4 text-left text-sm"
                        onClick={() => {
                          setMenuOpen(false);
                          m.run();
                        }}
                      >
                        {m.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        }
      />

      {kids.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-1">
          <Chip selected={scope === null} onClick={() => setScope(null)}>
            전체
          </Chip>
          {kids.map((k) => (
            <Chip key={k.id} selected={scope === k.id} onClick={() => setScope(k.id)}>
              {k.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex h-[46px] items-center justify-between px-5 pt-2">
        <span className="text-sm text-sub">
          {[countLabel(list), !scope ? place.memo : undefined].filter(Boolean).join(" · ")}
        </span>
        {list.length > 0 && (
          <button
            type="button"
            className="px-1 py-2 text-[15px] font-semibold text-deep"
            onClick={() => (selecting ? endSelecting() : setSelecting(true))}
          >
            {selecting ? "완료" : "옷 이동"}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="mx-4 mt-3 rounded-card border border-dashed border-[#D5D2CB] bg-white/60 px-5 py-10 text-center text-sm leading-relaxed text-sub">
          아직 이곳에 둔 옷이 없어요.
        </div>
      ) : (
        <div
          className={
            "grid grid-cols-2 gap-3 px-4 pt-1 @min-[600px]:grid-cols-3 @min-[900px]:grid-cols-4 " +
            (selecting ? "pb-[110px]" : "pb-6")
          }
        >
          {list.map((g) => {
            const p = g.placeId ? placeIndex.get(g.placeId) : undefined;
            return (
              <GarmentCard
                key={g.id}
                garment={g}
                // 이 장소 안에서는 하위 칸 이름만 보여 준다
                location={p?.parentId ? p.name : (p?.name ?? null)}
                selecting={selecting}
                selected={selected.includes(g.id)}
                onToggle={() =>
                  setSelected((s) => (s.includes(g.id) ? s.filter((x) => x !== g.id) : [...s, g.id]))
                }
              />
            );
          })}
        </div>
      )}

      {selecting && (
        <SelectionBar
          aboveTabBar={false}
          count={selected.length}
          onClear={() => setSelected([])}
          onMove={() => setMoveOpen(true)}
        />
      )}

      <PlacePickerSheet open={moveOpen} onClose={() => setMoveOpen(false)} onConfirm={move} />
      <PlaceEditSheet
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        editing={target}
        onSaved={() => {
          setRenameOpen(false);
          toast("이름을 바꿨어요");
        }}
      />
      <ConfirmDialog
        open={confirmOpen}
        message={
          removeCount > 0 ? (
            <>이 장소의 옷 {removeCount}개는 &apos;미지정&apos;으로 바뀌어요.</>
          ) : (
            <>이 장소를 삭제할까요?</>
          )
        }
        confirmLabel="삭제"
        onConfirm={remove}
        onClose={() => setConfirmOpen(false)}
      />
    </Screen>
  );
}
