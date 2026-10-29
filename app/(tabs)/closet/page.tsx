"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FilterSheet } from "@/components/closet/FilterSheet";
import { useData } from "@/components/DataProvider";
import { GarmentCard } from "@/components/garment/GarmentCard";
import { PlacePickerSheet } from "@/components/garment/PlacePickerSheet";
import { SelectionBar } from "@/components/garment/SelectionBar";
import { ChevronDownIcon, CloseIcon, FilterIcon, SearchIcon } from "@/components/icons";
import { Screen } from "@/components/layout/Screen";
import { Button, buttonClass } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import {
  activeFilterCount,
  EMPTY_QUERY,
  runClosetQuery,
  SORT_LABEL,
  type ClosetQuery,
  type SortKey,
} from "@/lib/closet-query";
import { movedMessage, placePath } from "@/lib/places";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/types";
import { useSessionState } from "@/lib/useSessionState";

export default function ClosetPage() {
  const { garments, placeIndex, moveGarments } = useData();
  const toast = useToast();

  const [query, setQuery] = useSessionState<ClosetQuery>("closet.query", EMPTY_QUERY);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  // 홈 검색에서 넘어온 검색어(?q=), 등록 직후 강조할 카드(?new=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q !== null) setQuery({ ...EMPTY_QUERY, q });
    // 보관함의 '위치 미지정 · 정하기'에서 넘어온 경우
    if (params.get("place") === "none") setQuery({ ...EMPTY_QUERY, places: ["none"] });
    const created = params.get("new");
    // 새로고침해도 다시 적용되지 않게 주소에서 지운다
    if (q !== null || created || params.has("place")) window.history.replaceState(window.history.state, "", "/closet");
    if (created) {
      // 새 카드가 보이도록 검색·필터를 풀고(정렬은 유지) 그 카드로 스크롤한다
      setQuery((cur) => ({ ...EMPTY_QUERY, sort: cur.sort }));
      setHighlight(created);
      requestAnimationFrame(() =>
        document.getElementById(`card-${created}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      const t = setTimeout(() => setHighlight(null), 2400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => runClosetQuery(garments, query, placeIndex), [garments, query, placeIndex]);
  const filterCount = activeFilterCount(query);
  const isFiltered = query.q.trim() !== "" || query.category !== "all" || filterCount > 0;

  const update = (patch: Partial<ClosetQuery>) => setQuery({ ...query, ...patch });
  const resetFilters = () => setQuery({ ...EMPTY_QUERY, sort: query.sort });

  const toggleSelected = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const endSelecting = () => {
    setSelecting(false);
    setSelected([]);
  };

  const confirmMove = async (placeId: string | null) => {
    const n = selected.length;
    await moveGarments(selected, placeId);
    setMoveOpen(false);
    endSelecting();
    toast(movedMessage(placeIndex, placeId, n));
  };

  // 여러 벌이 모두 같은 위치면 그 위치를 미리 골라 둔다
  const commonPlace = useMemo(() => {
    const ids = new Set(selected.map((id) => garments.find((g) => g.id === id)?.placeId ?? null));
    return ids.size === 1 ? [...ids][0] : undefined;
  }, [selected, garments]);

  return (
    <Screen
      withTabBar
      // 제목·검색·칩·필터 줄은 위에 고정하고 카드 목록만 스크롤한다
      header={
        <div>
          <div className="flex h-12 items-center justify-between px-5 pt-1.5">
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">
              내 옷장
              <small className="ml-2 text-sm font-normal tracking-[-0.01em] text-sub">총 {garments.length}벌</small>
            </h1>
            {garments.length > 0 && (
              <button
                type="button"
                className="px-1 py-2 text-[15px] font-semibold text-deep"
                onClick={() => (selecting ? endSelecting() : setSelecting(true))}
              >
                {selecting ? "완료" : "선택"}
              </button>
            )}
          </div>

          <SearchBox value={query.q} onChange={(q) => update({ q })} />

          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3">
            <Chip selected={query.category === "all"} onClick={() => update({ category: "all" })}>
              전체
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} selected={query.category === c} onClick={() => update({ category: c })}>
                {CATEGORY_LABEL[c]}
              </Chip>
            ))}
          </div>

          <div className="relative flex h-[38px] items-center justify-between px-5 pt-2.5">
            <button
              type="button"
              className={"flex items-center gap-1.5 text-sm font-medium " + (filterCount ? "text-deep" : "text-ink")}
              onClick={() => setFilterOpen(true)}
            >
              <FilterIcon />
              필터{filterCount > 0 && ` ${filterCount}`}
            </button>
            <button
              type="button"
              className="flex items-center gap-0.5 text-sm text-sub"
              aria-haspopup="menu"
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((o) => !o)}
            >
              {SORT_LABEL[query.sort]}
              <ChevronDownIcon />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <ul role="menu" className="absolute top-11 right-4 z-20 w-36 overflow-hidden rounded-[14px] border border-line bg-card">
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                    <li key={k}>
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={query.sort === k}
                        className={
                          "h-11 w-full px-4 text-left text-sm " + (query.sort === k ? "font-semibold text-deep" : "text-ink")
                        }
                        onClick={() => {
                          update({ sort: k });
                          setSortOpen(false);
                        }}
                      >
                        {SORT_LABEL[k]}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      }
    >
      {garments.length === 0 ? (
        <EmptyState
          action={
            <Link href="/closet/new" className={buttonClass()}>
              옷 등록
            </Link>
          }
        >
          아직 등록한 옷이 없어요.
          <br />첫 옷을 등록해 보세요.
        </EmptyState>
      ) : results.length === 0 ? (
        <EmptyState
          action={
            isFiltered && (
              <Button variant="outline" onClick={resetFilters}>
                필터 초기화
              </Button>
            )
          }
        >
          {query.q.trim() ? `'${query.q.trim()}'에 맞는 옷이 없어요.` : "조건에 맞는 옷이 없어요."}
        </EmptyState>
      ) : (
        <div
          className={
            "grid grid-cols-2 gap-3 px-4 pt-3 @min-[600px]:grid-cols-3 @min-[900px]:grid-cols-4 " +
            (selecting ? "pb-[84px]" : "pb-4")
          }
        >
          {results.map((g) => (
            <GarmentCard
              key={g.id}
              garment={g}
              location={placePath(placeIndex, g.placeId)}
              selecting={selecting}
              selected={selected.includes(g.id)}
              highlighted={highlight === g.id}
              onToggle={() => toggleSelected(g.id)}
            />
          ))}
        </div>
      )}

      {selecting && (
        <SelectionBar count={selected.length} onClear={() => setSelected([])} onMove={() => setMoveOpen(true)} />
      )}

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        query={query}
        onChange={setQuery}
        resultCount={results.length}
      />
      <PlacePickerSheet
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        current={commonPlace}
        onConfirm={confirmMove}
      />
    </Screen>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label className="mx-4 mt-2 flex h-11 items-center gap-2.5 rounded-full border border-line bg-card px-4 text-sub">
      <SearchIcon className="flex-none" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="이름·색상·위치로 검색"
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-sub [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="검색어 지우기"
          className="-mr-2 flex size-8 items-center justify-center"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
        >
          <CloseIcon size={18} />
        </button>
      )}
    </label>
  );
}

