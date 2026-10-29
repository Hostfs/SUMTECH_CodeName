import { placePath, rootPlaceId, type PlaceIndex } from "./places";
import { SEASON_LABEL } from "./theme";
import { CATEGORY_LABEL, type Category, type Garment, type Season } from "./types";

export type SortKey = "recent" | "name";

export const SORT_LABEL: Record<SortKey, string> = {
  recent: "최근 등록순",
  name: "이름순",
};

/** 'none' = 위치 미지정 */
export type PlaceFilter = string | "none";

export interface ClosetQuery {
  q: string;
  category: Category | "all";
  seasons: Season[];
  colors: string[];
  places: PlaceFilter[];
  sort: SortKey;
}

export const EMPTY_QUERY: ClosetQuery = { q: "", category: "all", seasons: [], colors: [], places: [], sort: "recent" };

/** 필터 시트에서 고른 조건 수 (종류 칩은 따로 보이므로 세지 않는다) */
export function activeFilterCount(q: ClosetQuery) {
  return q.seasons.length + q.colors.length + q.places.length;
}

/** 이름·색상·위치(+종류, 계절, 브랜드)로 찾는다. 띄어쓴 단어는 모두 들어 있어야 한다. */
function matchesText(g: Garment, words: string[], index: PlaceIndex) {
  if (words.length === 0) return true;
  const hay = [
    g.name,
    g.color,
    CATEGORY_LABEL[g.category],
    ...g.seasons.map((s) => SEASON_LABEL[s]),
    placePath(index, g.placeId) ?? "위치 미지정 미지정",
    g.brand ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const compact = hay.replace(/\s+/g, "");
  return words.every((w) => hay.includes(w) || compact.includes(w));
}

export function runClosetQuery(garments: Garment[], query: ClosetQuery, index: PlaceIndex): Garment[] {
  const words = query.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const out = garments.filter((g) => {
    if (query.category !== "all" && g.category !== query.category) return false;
    if (query.seasons.length && !g.seasons.some((s) => query.seasons.includes(s))) return false;
    if (query.colors.length && !query.colors.includes(g.color)) return false;
    if (query.places.length) {
      const root = rootPlaceId(index, g.placeId);
      const key: PlaceFilter = root ?? "none";
      if (!query.places.includes(key)) return false;
    }
    return matchesText(g, words, index);
  });
  return out.sort((a, b) =>
    query.sort === "name" ? a.name.localeCompare(b.name, "ko") : b.createdAt.localeCompare(a.createdAt),
  );
}
