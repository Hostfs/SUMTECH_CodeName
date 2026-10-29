import type { Outing, OutingKind } from "./types";

export const OUTING_LABEL: Record<OutingKind, string> = {
  laundry: "세탁",
  repair: "수선",
};

/** 맡긴 동안 보관 위치가 되는 장소 이름 */
export const OUTING_PLACE_NAME: Record<OutingKind, string> = {
  laundry: "세탁소",
  repair: "수선집",
};

/** 'YYYY-MM-DD' 또는 ISO 시각 → '11월 3일' (Asia/Seoul 기준 날짜) */
export function shortDate(value: string): string {
  const day = value.length > 10 ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(value)) : value;
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** 상세 상태 카드의 보조 줄: '우리동네세탁소 · 11월 3일에 찾을 예정' */
export function outingSummary(o: Outing): string {
  const parts = [o.shop, o.dueDate ? `${shortDate(o.dueDate)}에 찾을 예정` : undefined].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : `${shortDate(o.since)}에 맡겼어요`;
}
