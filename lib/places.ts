import type { Garment, Place } from "./types";

export const UNASSIGNED_LABEL = "위치 미지정";

export type PlaceIndex = Map<string, Place>;

export function indexPlaces(places: Place[]): PlaceIndex {
  return new Map(places.map((p) => [p.id, p]));
}

/** 위치 표기. 카드는 '옷장 A · 왼쪽 행거', 상세는 '옷장 A › 왼쪽 행거' */
export function placePath(index: PlaceIndex, placeId: string | null, sep: " · " | " › " = " · "): string | null {
  if (!placeId) return null;
  const p = index.get(placeId);
  if (!p) return null;
  const parent = p.parentId ? index.get(p.parentId) : undefined;
  return parent ? `${parent.name}${sep}${p.name}` : p.name;
}

/** 맨 위 장소 id (필터에서 '옷장 A'를 고르면 그 하위 칸도 포함) */
export function rootPlaceId(index: PlaceIndex, placeId: string | null): string | null {
  if (!placeId) return null;
  const p = index.get(placeId);
  return p?.parentId ?? p?.id ?? null;
}

export function rootPlaces(places: Place[]): Place[] {
  return places.filter((p) => !p.parentId);
}

export function childPlaces(places: Place[], parentId: string): Place[] {
  return places.filter((p) => p.parentId === parentId);
}

/**
 * 받침에 맞춰 '로/으로'를 붙인다. ㄹ 받침과 받침 없는 글자는 '로'.
 * 숫자와 영문은 한국어로 읽는 소리로 판단한다 (1→일 '로', 3→삼 '으로').
 */
export function withRo(word: string): string {
  const last = word.trim().slice(-1);
  const DIGIT: Record<string, boolean> = { "0": true, "1": false, "2": false, "3": true, "4": false, "5": false, "6": true, "7": false, "8": false, "9": false };
  let needEu = false;
  if (last in DIGIT) needEu = DIGIT[last];
  else if (/[가-힣]/.test(last)) {
    const jong = (last.charCodeAt(0) - 0xac00) % 28;
    needEu = jong !== 0 && jong !== 8; // 8 = ㄹ
  } else needEu = /[MNmn]/.test(last); // 엠·엔만 받침이 있다 (엘은 ㄹ)
  return needEu ? "으로" : "로";
}

/** 위치를 옮긴 뒤 토스트. 여러 벌: "n개의 옷을 '옷장 A › 서랍 2'로 옮겼어요", 한 벌: "'…'로 옮겼어요" */
export function movedMessage(index: PlaceIndex, placeId: string | null, count?: number): string {
  const name = placeId ? placePath(index, placeId, " › ") ?? UNASSIGNED_LABEL : UNASSIGNED_LABEL;
  const head = count === undefined ? "" : `${count}개의 옷을 `;
  return `${head}'${name}'${withRo(name)} 옮겼어요`;
}

/** 장소(하위 칸 포함)에 들어 있는 옷 */
export function garmentsInPlace(garments: Garment[], places: Place[], placeId: string): Garment[] {
  const ids = new Set([placeId, ...childPlaces(places, placeId).map((p) => p.id)]);
  return garments.filter((g) => g.placeId && ids.has(g.placeId));
}

/** 옷 개수 단위: 모두 신발이면 '켤레' */
export function countLabel(list: Garment[]): string {
  const unit = list.length > 0 && list.every((g) => g.category === "shoes") ? "켤레" : "벌";
  return `${list.length}${unit}`;
}

/** 하위 칸 요약: '행거 2 · 서랍 3' (이름에 행거·서랍이 들어가면 묶고, 나머지는 '칸') */
export function childSummary(places: Place[], parentId: string): string | null {
  const kids = childPlaces(places, parentId);
  if (kids.length === 0) return null;
  const groups = new Map<string, number>();
  for (const k of kids) {
    const key = k.name.includes("행거") ? "행거" : k.name.includes("서랍") ? "서랍" : "칸";
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups].map(([k, n]) => `${k} ${n}`).join(" · ");
}
