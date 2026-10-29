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
  createdAt: string;
  updatedAt: string;
}

export type OutfitSlot = "outer" | "top" | "bottom" | "shoes" | "etc";

export interface Outfit {
  id: string;
  name: string;
  memo?: string;
  /** 슬롯별 garment id */
  slots: Partial<Record<OutfitSlot, string>>;
  createdAt: string;
}

export interface Profile {
  name: string;
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
