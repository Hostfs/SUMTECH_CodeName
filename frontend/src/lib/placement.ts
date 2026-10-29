import type { Garment, Loc, Space } from '../data/garments';
import type { Season } from './seasons';

export interface Proposal {
  garment: Garment;
  /** null 이면 놓을 자리가 없다(용량 초과) */
  loc: Loc | null;
  reason: string;
}

export const countIn = (garments: Garment[], space: string, slot?: string) =>
  garments.filter((g) => g.loc?.space === space && (slot === undefined || g.loc.slot === slot)).length;

/**
 * 미배치 옷에 보관 자리를 추천한다. 추천은 미확정이며, 사용자가 '배치 완료'를 눌러야 위치가 바뀐다 (R07).
 * 규칙: 신발 → 선반 / 철 지난 옷 → 상자 / 상의·아우터 → 걸기 / 하의 → 서랍·걸기. 용량이 찬 공간은 건너뛴다.
 */
export function recommendPlacement(garments: Garment[], spaces: Space[], season: Season): Proposal[] {
  const planned = new Map<string, number>(); // 이번 추천 안에서 이미 배정한 수
  const used = (name: string) => countIn(garments, name) + (planned.get(name) ?? 0);

  return garments
    .filter((g) => !g.loc)
    .map((garment): Proposal => {
      const offSeason = garment.seasons.length > 0 && !garment.seasons.includes(season);
      const order: Space['kind'][] =
        garment.category === '신발' ? ['선반']
        : offSeason ? ['상자', '서랍', '걸기']
        : garment.category === '하의' ? ['서랍', '걸기', '상자']
        : ['걸기', '서랍', '상자'];
      const why =
        garment.category === '신발' ? '신발은 선반에 두면 꺼내기 편해요'
        : offSeason ? `지금(${season})은 입지 않는 계절 옷이라 상자에 보관해요`
        : garment.category === '하의' ? '자주 입는 하의라 서랍에 접어 두면 좋아요'
        : '구김이 가지 않게 걸어 두면 좋아요';

      for (const kind of order) {
        for (const sp of spaces.filter((s) => s.kind === kind && used(s.name) < s.capacity)) {
          // 칸이 있으면 이름이 어울리는 칸 중 가장 한가한 곳
          let slot: string | undefined;
          if (sp.slots.length) {
            const pref = sp.slots.filter((s) => (garment.category === '하의' ? s.includes('서랍') : s.includes('행거') || s.includes('단') || s.includes('박스')));
            const cands = pref.length ? pref : sp.slots;
            slot = [...cands].sort((a, b) => countIn(garments, sp.name, a) - countIn(garments, sp.name, b))[0];
          }
          planned.set(sp.name, (planned.get(sp.name) ?? 0) + 1);
          return { garment, loc: { space: sp.name, slot }, reason: why };
        }
      }
      return { garment, loc: null, reason: '자리가 남은 공간이 없어요. 공간을 추가하거나 비워 주세요' };
    });
}
