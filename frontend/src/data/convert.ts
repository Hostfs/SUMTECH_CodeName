// 서버 값(코드) ↔ 화면 값(한국어 이름) 변환. 서버의 세부 종류·공간 유형·소재 표를 화면의 모양·종류·소재 글자로 옮긴다.
import type { Season } from '../lib/seasons';
import type { CareView, MaterialView } from '../lib/api';
import { colorHex, type Care, type Category, type Shape, type SpaceKind } from './garments';

export const CATEGORY_OF: Record<string, Category> = { TOP: '상의', BOTTOM: '하의', OUTER: '아우터', SHOES: '신발', DRESS: '기타', ETC: '기타' };

const SHAPE_OF: Record<string, Shape> = {
  SHORT_SLEEVE_TEE: 'tee', LONG_SLEEVE_TEE: 'tee', SHIRT: 'shirt', KNIT: 'knit', TOP_ETC: 'tee',
  JACKET: 'blazer', COAT: 'coat', PADDING: 'puffer', OUTER_ETC: 'blazer',
  PANTS: 'pants', JEANS: 'pants', SHORTS: 'shorts', SKIRT: 'skirt', PLEATED_SKIRT: 'pleated', BOTTOM_ETC: 'pants',
  DRESS: 'skirt', ETC: 'tee', SNEAKERS: 'sneaker', LOAFERS: 'loafer', BOOTS: 'boots',
};
export const shapeOf = (subType: string): Shape => SHAPE_OF[subType] ?? 'tee';

const SUB_TYPE_FOR: Record<Category, [Partial<Record<Shape, string>>, string]> = {
  상의: [{ tee: 'SHORT_SLEEVE_TEE', knit: 'KNIT', shirt: 'SHIRT' }, 'TOP_ETC'],
  아우터: [{ blazer: 'JACKET', coat: 'COAT', puffer: 'PADDING' }, 'OUTER_ETC'],
  하의: [{ pants: 'PANTS', shorts: 'SHORTS', skirt: 'SKIRT', pleated: 'PLEATED_SKIRT' }, 'BOTTOM_ETC'],
  신발: [{ sneaker: 'SNEAKERS', loafer: 'LOAFERS', boots: 'BOOTS' }, 'SNEAKERS'],
  기타: [{}, 'ETC'],
};

/** 화면의 종류·모양을 서버 세부 종류로. 지금 세부 종류가 같은 종류·모양이면(예: 청바지, 원피스) 그대로 둔다. */
export function subTypeFor(category: Category, shape: Shape, current?: { subType: string; category: string }): string {
  if (current && CATEGORY_OF[current.category] === category && shapeOf(current.subType) === shape) return current.subType;
  const [byShape, fallback] = SUB_TYPE_FOR[category];
  return byShape[shape] ?? fallback;
}

/** 보온 정도(날씨 추천용)는 모양에서 정한다 (등록 화면과 같은 값) */
export const WARMTH: Record<Shape, number> = { tee: 1, shirt: 2, knit: 4, blazer: 3, coat: 4, puffer: 5, pants: 2, shorts: 1, skirt: 2, pleated: 2, sneaker: 0, loafer: 0, boots: 0 };

const SEASON_OF: Record<string, Season> = { SPRING: '봄', SUMMER: '여름', AUTUMN: '가을', WINTER: '겨울' };
const SEASON_CODE: Record<Season, string> = { 봄: 'SPRING', 여름: 'SUMMER', 가을: 'AUTUMN', 겨울: 'WINTER' };
export const seasonsOf = (codes: string[]): Season[] => codes.map((c) => SEASON_OF[c]).filter(Boolean);
export const seasonCodes = (s: Season[]) => s.map((x) => SEASON_CODE[x]);

const KIND_OF: Record<string, SpaceKind> = { HANG: '걸기', FOLD: '서랍', SHELF: '선반', BOX: '상자', LONG_TERM: '상자', OFFSITE: '집 밖' };
const TYPE_OF: Record<SpaceKind, string> = { 걸기: 'HANG', 서랍: 'FOLD', 선반: 'SHELF', 상자: 'LONG_TERM', '집 밖': 'OFFSITE' };
export const spaceKindOf = (type: string): SpaceKind => KIND_OF[type] ?? '상자';
export const spaceTypeOf = (kind: SpaceKind) => TYPE_OF[kind];

export function careOf(c: CareView): Care {
  return {
    id: String(c.id),
    kind: c.careType === 'WASH' ? '세탁' : '수선',
    place: c.place === 'HOME' ? '자택' : '업체',
    vendor: c.shopName ?? undefined,
    since: c.droppedOn,
    due: c.dueOn ?? c.droppedOn,
  };
}

export const hexOf = (name: string | null, hex: string | null) => hex ?? colorHex(name ?? '');

// ---- 소재: 서버는 부위·섬유·혼용률 표, 화면은 '울 70%, 폴리에스터 30%' 같은 글자 ----

const PARTS: Record<string, string> = { 겉감: 'SHELL', 안감: 'LINING', 배색: 'TRIM', 충전재: 'FILL' };
const FIBERS: [string, string[]][] = [
  ['COTTON', ['면', '코튼', '순면']], ['POLYESTER', ['폴리에스터', '폴리에스테르', '폴리']], ['WOOL', ['울', '양모']],
  ['ACRYLIC', ['아크릴']], ['NYLON', ['나일론']], ['RAYON', ['레이온']],
  ['POLYURETHANE', ['폴리우레탄', '스판', '스판덱스', '엘라스틴']], ['LINEN', ['마', '린넨', '리넨']], ['SILK', ['실크']],
  ['CASHMERE', ['캐시미어']], ['VISCOSE', ['비스코스']], ['MODAL', ['모달']], ['LYOCELL', ['라이오셀', '텐셀']],
  ['LEATHER', ['가죽', '레더']], ['DOWN', ['다운', '덕다운', '구스다운']], ['FEATHER', ['페더', '깃털']], ['OTHER', ['기타 섬유', '기타']],
];
const fiberCode = (name: string) => FIBERS.find(([, names]) => names.includes(name.replace(/\s+/g, ' ').trim()))?.[0];

const pct = (n: number) => `${Number(n)}%`;
export function materialText(list: MaterialView[]): string {
  const onlyShell = list.every((m) => m.part === 'SHELL');
  return list.map((m) => `${onlyShell ? '' : `${m.partLabel} `}${m.fiberLabel} ${pct(m.percent)}`).join(', ');
}

export interface MaterialInput { part: string; fiber: string; percent: number }

/** '겉감 면 80%, 폴리 20%' → 서버 입력. 혼용률을 하나만 빼먹었으면 나머지로 채운다. 읽을 수 없으면 이유를 던진다. */
export function parseMaterials(text: string): MaterialInput[] {
  const tokens = text.split(/[,/·\n]/).map((t) => t.trim()).filter(Boolean);
  const rows: { part: string; fiber: string; percent: number | null }[] = [];
  for (const raw of tokens) {
    let t = raw;
    let part = 'SHELL';
    const p = Object.keys(PARTS).find((k) => t.startsWith(k));
    if (p) {
      part = PARTS[p];
      t = t.slice(p.length).trim();
    }
    const m = /^(.*?)\s*(\d+(?:\.\d+)?)?\s*%?$/.exec(t);
    const fiber = m && fiberCode(m[1]);
    if (!fiber) throw new Error(`소재 '${raw}'를 읽지 못했어요. '면 80%, 폴리에스터 20%'처럼 적어 주세요`);
    rows.push({ part, fiber, percent: m[2] ? Number(m[2]) : null });
  }
  for (const part of new Set(rows.map((r) => r.part))) {
    const inPart = rows.filter((r) => r.part === part);
    const missing = inPart.filter((r) => r.percent === null);
    if (missing.length === 1) missing[0].percent = 100 - inPart.reduce((s, r) => s + (r.percent ?? 0), 0);
    else if (missing.length > 1) throw new Error('소재가 여러 개면 혼용률(%)을 함께 적어 주세요. 예: 면 80%, 폴리에스터 20%');
  }
  return rows.map((r) => ({ part: r.part, fiber: r.fiber, percent: r.percent! }));
}
