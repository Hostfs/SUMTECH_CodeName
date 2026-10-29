import { statusOf, type Category, type Garment } from '../data/garments';
import type { Season } from './seasons';
import type { Weather } from './weather';

/**
 * 오늘 날씨에 맞는 옷을 내 옷장에서 고른다. 지금 꺼내 입을 수 있는('보관 중') 옷만 후보다.
 * AI 추천(R06)이 붙기 전의 규칙 기반 초안: 체감 온도 → 필요한 보온 정도 → 가장 가까운 옷.
 */
export function recommend(garments: Garment[], w: Weather, season: Season): Garment[] {
  const t = w.feels;
  const target = t <= 2 ? 5 : t <= 8 ? 4 : t <= 13 ? 3 : t <= 18 ? 2 : 1;
  const ready = garments.filter((g) => statusOf(g) === '보관 중' && g.warmth > 0);

  const pick = (cats: Category[]) =>
    ready
      .filter((g) => cats.includes(g.category))
      .map((g) => ({ g, score: Math.abs(g.warmth - target) - (g.seasons.includes(season) ? 0.6 : 0) }))
      .sort((a, b) => a.score - b.score)[0]?.g;

  const outer = target >= 2 ? pick(['아우터']) : undefined;
  const top = pick(['상의']);
  const second = outer ? top : pick(['하의']);
  return [outer ?? top, second].filter((g, i, a): g is Garment => !!g && a.indexOf(g) === i);
}
