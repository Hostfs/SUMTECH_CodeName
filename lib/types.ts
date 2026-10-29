import type { Season } from "./theme";

export type { Season, ThemeSetting } from "./theme";

export type Category = "top" | "bottom" | "outer" | "shoes" | "etc";

export const CATEGORIES: Category[] = ["top", "bottom", "outer", "shoes", "etc"];

export const CATEGORY_LABEL: Record<Category, string> = {
  top: "상의",
  bottom: "하의",
  outer: "아우터",
  shoes: "신발",
  etc: "기타",
};

/** 보관 장소. parentId가 있으면 하위 칸(예: 옷장 A › 서랍 2). 1단계 하위까지만 쓴다. */
export interface Place {
  id: string;
  name: string;
  parentId?: string | null;
  memo?: string;
}

/** 세탁·수선을 맡긴 상태. 맡긴 동안 보관 위치는 '세탁소'·'수선집'이 되고, 찾아올 때 원래 위치로 돌려 둔다. */
export type OutingKind = "laundry" | "repair";

export interface Outing {
  kind: OutingKind;
  /** 맡긴 곳 이름 (예: 우리동네세탁소) */
  shop?: string;
  /** 찾을 예정일 'YYYY-MM-DD' */
  dueDate?: string;
  memo?: string;
  /** 맡기기 전 보관 위치. 찾아올 때 이 위치를 미리 골라 준다. */
  previousPlaceId: string | null;
  since: string;
}

export interface Garment {
  id: string;
  name: string;
  category: Category;
  /** 색 이름(예: '브라운') */
  color: string;
  seasons: Season[];
  /** null = '위치 미지정' */
  placeId: string | null;
  photoUrl?: string;
  brand?: string;
  size?: string;
  material?: string;
  memo?: string;
  careInfo?: { text: string; confirmed: boolean }[];
  /** 지금 세탁·수선을 맡겨 둔 상태면 있다 */
  outing?: Outing;
  createdAt: string;
  updatedAt: string;
}

/** 코디 칸. 기타 옷은 이름으로 모자(hat)와 가방·소품(etc)으로 나눈다. */
export type OutfitSlot = "outer" | "top" | "bottom" | "shoes" | "hat" | "etc";

export const SLOT_LABEL: Record<OutfitSlot, string> = {
  outer: "아우터",
  top: "상의",
  bottom: "하의",
  shoes: "신발",
  hat: "모자",
  etc: "가방·기타",
};

const HAT = /모자|캡|비니|햇|버킷|베레|페도라|헬멧|hat|cap|beanie|beret/i;

/** 옷이 들어갈 코디 칸. 기타 옷은 이름에 모자 낱말이 있으면 모자, 아니면 가방·기타. */
export function slotOf(g: Pick<Garment, "category" | "name">): OutfitSlot {
  if (g.category !== "etc") return g.category;
  return HAT.test(g.name) ? "hat" : "etc";
}

export interface Outfit {
  id: string;
  name: string;
  memo?: string;
  /** 슬롯별 garment id */
  slots: Partial<Record<OutfitSlot, string>>;
  createdAt: string;
}

/** 코디 마네킹 체형 */
export interface Body {
  heightCm: number;
  weightKg: number;
}

export interface Profile {
  name: string;
  body?: Body;
}

/** 등록 화면의 색 점 8개 (design/html/add_autumn.html) */
export const COLOR_SWATCHES: { name: string; hex: string }[] = [
  { name: "화이트", hex: "#F4F3EF" },
  { name: "베이지", hex: "#D9C7A4" },
  { name: "브라운", hex: "#B58A5E" },
  { name: "블랙", hex: "#2D2D30" },
  { name: "네이비", hex: "#2F4C7C" },
  { name: "그레이", hex: "#8A8D91" },
  { name: "카키", hex: "#8E9272" },
  { name: "버건디", hex: "#8C4D4D" },
];
