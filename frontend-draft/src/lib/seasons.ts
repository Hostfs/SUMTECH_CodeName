export const SEASONS = ['봄', '여름', '가을', '겨울'] as const;
export type Season = (typeof SEASONS)[number];
export type ThemeMode = 'auto' | Season;

/** CSS 테마 키 (`[data-season="..."]`). 색 값은 styles/theme.css 에 있다. */
export const SEASON_KEY: Record<Season, string> = {
  봄: 'spring',
  여름: 'summer',
  가을: 'autumn',
  겨울: 'winter',
};

export const SEASON_SWATCH: Record<Season, string> = {
  봄: '#F4A9A6',
  여름: '#2EC4B0',
  가을: '#AE7443',
  겨울: '#1B4A82',
};

export function seasonFromKey(key: string | null): Season | null {
  return SEASONS.find((s) => SEASON_KEY[s] === key) ?? null;
}

export function seasonOf(date: Date): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return '봄';
  if (m >= 6 && m <= 8) return '여름';
  if (m >= 9 && m <= 11) return '가을';
  return '겨울';
}
