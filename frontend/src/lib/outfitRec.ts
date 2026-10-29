import { statusOf, type Garment, type Shape } from '../data/garments';
import type { Season } from './seasons';

export const SITUATIONS = ['출근', '데이트', '캐주얼', '모임·면접'] as const;
export type Situation = (typeof SITUATIONS)[number];

export interface Suggestion {
  top: Garment;
  /** 쌀쌀한 계절에는 겉옷을 겹쳐 입는다 */
  outer?: Garment;
  bottom: Garment;
  shoes?: Garment;
  score: number;
  reasons: string[];
}

// 모양별 상황 점수. AI 추천(R06)이 붙기 전의 규칙 기반 초안이고, 같은 입출력(옷 ID + 이유)으로 대체할 수 있다.
const TOP: Record<Situation, Partial<Record<Shape, number>>> = {
  출근: { shirt: 3, blazer: 3, knit: 2, coat: 1, tee: -2, puffer: -1 },
  데이트: { knit: 3, shirt: 2, blazer: 2, tee: 1, coat: 1, puffer: -1 },
  캐주얼: { tee: 3, knit: 2, shirt: 1, puffer: 1, blazer: -1 },
  '모임·면접': { blazer: 4, shirt: 3, knit: 1, coat: 1, tee: -3, puffer: -3 },
};
const BOTTOM: Record<Situation, Partial<Record<Shape, number>>> = {
  출근: { pants: 3, pleated: 1, skirt: 1, shorts: -3 },
  데이트: { skirt: 3, pleated: 3, pants: 2, shorts: 0 },
  캐주얼: { pants: 2, shorts: 2, skirt: 1, pleated: 0 },
  '모임·면접': { pants: 3, pleated: 2, skirt: 2, shorts: -4 },
};
const TRAIT: Partial<Record<Shape, string>> = {
  shirt: '단정한 셔츠', blazer: '정돈된 블레이저', knit: '부드러운 니트', tee: '편한 티셔츠',
  coat: '무게감 있는 코트', pants: '깔끔한 바지', pleated: '단정한 플리츠 스커트', skirt: '차분한 스커트', shorts: '가벼운 반바지',
};
const SHOES: Record<Situation, Partial<Record<Shape, number>>> = {
  출근: { loafer: 3, boots: 1, sneaker: 0 },
  데이트: { loafer: 2, sneaker: 2, boots: 2 },
  캐주얼: { sneaker: 3, boots: 1, loafer: 0 },
  '모임·면접': { loafer: 4, boots: 1, sneaker: -2 },
};
const NEUTRAL = new Set(['화이트', '아이보리', '베이지', '그레이', '차콜', '블랙', '네이비', '카멜']);

/**
 * 지금 입을 수 있는('보관 중') 옷만으로 상의(+아우터)·하의·신발 조합을 만든다.
 * 세탁·수선 중이거나 위치가 없는 옷은 후보에서 뺀다 (S5).
 */
export function suggestOutfits(garments: Garment[], season: Season, situation: Situation): Suggestion[] {
  const usable = garments.filter((g) => statusOf(g) === '보관 중');
  const tops = usable.filter((g) => g.category === '상의');
  const outers = usable.filter((g) => g.category === '아우터');
  const bottoms = usable.filter((g) => g.category === '하의');
  const shoeList = usable.filter((g) => g.category === '신발');

  const seasonal = (g: Garment) => g.seasons.includes(season);
  const pool = (list: Garment[]) => {
    const inSeason = list.filter(seasonal);
    return inSeason.length ? inSeason : list;
  };

  const combos: Suggestion[] = [];
  for (const top of pool(tops)) {
    for (const bottom of pool(bottoms)) {
      const reasons: string[] = [];
      let score = 0;

      const t = TOP[situation][top.shape] ?? 0;
      const b = BOTTOM[situation][bottom.shape] ?? 0;
      score += t + b;
      if (t > 0 && TRAIT[top.shape]) reasons.push(`${situation}에 어울리는 ${TRAIT[top.shape]}`);
      if (b > 0 && TRAIT[bottom.shape]) reasons.push(`${TRAIT[bottom.shape]}와 짝이 좋아요`);

      if (seasonal(top) && seasonal(bottom)) {
        score += 2;
        reasons.push(`둘 다 ${season}에 입는 옷으로 분류돼 있어요`);
      }
      if (NEUTRAL.has(top.color) && NEUTRAL.has(bottom.color)) {
        score += 1;
        reasons.push(`${top.color}와 ${bottom.color}는 무난하게 어울리는 색이에요`);
      }
      if (top.color === bottom.color) score -= 2;
      if (top.warmth >= 4 && bottom.warmth <= 1) score -= 2;

      // 아우터: 여름이 아니면 계절에 맞는 겉옷 하나를 겹친다 (겨울에는 점수가 낮아도 꼭 넣는다)
      const outer =
        season === '여름'
          ? undefined
          : outers
              .filter(seasonal)
              .map((g) => ({ g, v: (TOP[situation][g.shape] ?? 0) + (NEUTRAL.has(g.color) ? 1 : 0) - (g.color === top.color || g.color === bottom.color ? 1 : 0) }))
              .filter((o) => season === '겨울' || o.v >= 0)
              .sort((a, b) => b.v - a.v)[0];
      if (outer) {
        score += outer.v;
        reasons.push(`겉옷은 ${outer.g.name} — ${outer.v > 1 ? `${situation}에 잘 어울려요` : `${season}에 걸치기 좋아요`}`);
      }

      // 신발: 상황·계절에 맞고 하의와 색이 겹치지 않는 것 (신발이 없으면 상하의만 추천)
      const shoes = pool(shoeList)
        .map((g) => ({ g, v: (SHOES[situation][g.shape] ?? 0) + (seasonal(g) ? 2 : -2) + (NEUTRAL.has(g.color) ? 1 : 0) - (g.color === bottom.color ? 1 : 0) }))
        .sort((a, b) => b.v - a.v)[0];
      if (shoes) {
        score += shoes.v;
        reasons.push(`신발은 ${shoes.g.name} — ${shoes.v > 2 ? `${situation} 분위기에 잘 맞아요` : '무난하게 어울려요'}`);
      }

      combos.push({ top, outer: outer?.g, bottom, shoes: shoes?.g, score, reasons });
    }
  }

  combos.sort((a, b) => b.score - a.score || a.top.name.localeCompare(b.top.name, 'ko'));
  // 같은 상의가 반복되지 않게 상의마다 가장 좋은 조합 하나만, 최대 3개
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const c of combos) {
    if (seen.has(c.top.id)) continue;
    seen.add(c.top.id);
    if (!c.reasons.length) c.reasons.push(`${season}에 지금 꺼내 입을 수 있는 조합이에요`);
    out.push(c);
    if (out.length === 3) break;
  }
  return out;
}
