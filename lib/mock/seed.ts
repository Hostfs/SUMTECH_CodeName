import type { Category, Garment, Outfit, Place, Profile, Season } from "../types";
import { MOCK_ART, svgDataUrl } from "./art";

// 이름, 개수, 위치는 모두 예시 데이터다 (CLAUDE.md 10절).

export const SEED_PROFILE: Profile = { name: "하늘" };

export const SEED_PLACES: Place[] = [
  { id: "p-wa", name: "옷장 A" },
  { id: "p-wa-l", name: "왼쪽 행거", parentId: "p-wa" },
  { id: "p-wa-r", name: "오른쪽 행거", parentId: "p-wa" },
  { id: "p-wa-d1", name: "서랍 1", parentId: "p-wa" },
  { id: "p-wa-d2", name: "서랍 2", parentId: "p-wa" },
  { id: "p-wa-d3", name: "서랍 3", parentId: "p-wa" },
  { id: "p-wb", name: "옷장 B" },
  { id: "p-wb-h", name: "행거", parentId: "p-wb" },
  { id: "p-box1", name: "수납 상자 1", memo: "니트·이불류" },
  { id: "p-box2", name: "수납 상자 2", memo: "계절 지난 옷" },
  { id: "p-shoe", name: "신발장" },
  { id: "p-shoe-1", name: "1단", parentId: "p-shoe" },
  { id: "p-shoe-2", name: "2단", parentId: "p-shoe" },
];

type Row = [name: string, category: Category, color: string, seasons: Season[], placeId: string | null, extra?: Partial<Garment>];

// 위에서 아래로 최근 등록한 순서. 가을 목업(closet_autumn.html)의 카드 순서가 맨 앞에 오게 했다.
// 목업의 '옷장 A · 행거'는 옷장 A에 행거가 둘(왼쪽·오른쪽)이라 '오른쪽 행거'로 정리했다.
const ROWS: Row[] = [
  ["브라운 니트", "top", "브라운", ["autumn", "winter"], "p-box1", { size: "M", memo: "두께감 있는 니트" }],
  ["카멜 롱코트", "outer", "베이지", ["autumn", "winter"], "p-wa-l"],
  ["카키 셔츠", "top", "카키", ["spring", "autumn"], "p-wa-r"],
  ["차콜 슬랙스", "bottom", "그레이", ["spring", "autumn", "winter"], "p-wb-h"],
  ["블랙 앵클부츠", "shoes", "블랙", ["autumn", "winter"], "p-shoe-1"],
  ["버건디 니트", "top", "버건디", ["autumn", "winter"], null],
  ["차콜 롱코트", "outer", "그레이", ["winter"], "p-wa-r"],
  ["아이보리 니트", "top", "화이트", ["autumn", "winter"], "p-box1"],
  ["블랙 패딩", "outer", "블랙", ["winter"], "p-wb-h"],
  ["그레이 울 팬츠", "bottom", "그레이", ["autumn", "winter"], "p-wa-d3"],
  ["네이비 니트", "top", "네이비", ["winter"], "p-box2"],
  ["브라운 부츠", "shoes", "브라운", ["winter"], null],
  ["베이지 블레이저", "outer", "베이지", ["spring", "autumn"], "p-wa-l"],
  ["하늘색 셔츠", "top", "하늘색", ["spring", "summer"], "p-wa-d1"],
  ["아이보리 플리츠 스커트", "bottom", "화이트", ["spring"], "p-wb-h"],
  ["화이트 스니커즈", "shoes", "화이트", ["spring", "summer", "autumn"], "p-shoe-2"],
  ["크림 니트", "top", "베이지", ["spring"], "p-box2"],
  ["연청 데님 팬츠", "bottom", "하늘색", ["spring", "summer"], null],
  ["화이트 티셔츠", "top", "화이트", ["summer"], "p-wa-d1"],
  ["민트 린넨 셔츠", "top", "민트", ["summer"], "p-wa-r"],
  ["베이지 반바지", "bottom", "베이지", ["summer"], "p-wa-d2"],
  ["네이비 스커트", "bottom", "네이비", ["summer"], "p-wb-h"],
  ["카키 티셔츠", "top", "카키", ["summer"], null],
];

const BASE = Date.parse("2026-10-28T12:00:00+09:00");

export const SEED_GARMENTS: Garment[] = ROWS.map(([name, category, color, seasons, placeId, extra], i) => {
  const at = new Date(BASE - i * 6 * 3600_000).toISOString();
  return {
    id: `g${String(i + 1).padStart(2, "0")}`,
    name,
    category,
    color,
    seasons,
    placeId,
    photoUrl: MOCK_ART[name] ? svgDataUrl(MOCK_ART[name]) : undefined,
    createdAt: at,
    updatedAt: at,
    ...extra,
  };
});

export const SEED_OUTFITS: Outfit[] = [
  {
    id: "o1",
    name: "가을 출근룩",
    slots: { outer: "g02", top: "g01", bottom: "g04", shoes: "g05" },
    createdAt: new Date(BASE).toISOString(),
  },
];
