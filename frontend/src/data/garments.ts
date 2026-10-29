import type { Season } from '../lib/seasons';
import type { PhotoKind, Points } from '../lib/cutout';

export const CATEGORIES = ['상의', '하의', '아우터', '신발', '기타'] as const;
export type Category = (typeof CATEGORIES)[number];

/** 옷 일러스트 모양 (GarmentArt 가 그린다). 3D 템플릿은 코디 스튜디오 단계에서 따로 다룬다. */
export type Shape =
  | 'tee' | 'knit' | 'shirt' | 'coat' | 'blazer' | 'puffer'
  | 'pants' | 'shorts' | 'skirt' | 'pleated' | 'sneaker' | 'loafer' | 'boots';

export interface Loc {
  space: string;
  slot?: string;
}

export interface Care {
  /** 서버의 세탁·수선 기록 ID (새로 맡길 때는 없다) */
  id?: string;
  kind: '세탁' | '수선';
  place: '자택' | '업체';
  vendor?: string;
  /** 맡긴 날 YYYY-MM-DD (없으면 검사하지 않는다) */
  since?: string;
  /** 회수 예정일 YYYY-MM-DD */
  due: string;
}

/** 실제 옷 사진(누끼 딴 PNG)과 마네킹에 입힐 때 쓰는 기준점 */
export interface Photo {
  /** 'idb:<id>'(브라우저에 저장한 사진) 또는 주소 */
  src: string;
  w: number;
  h: number;
  kind: PhotoKind;
  /** 사진 픽셀 좌표의 핏 기준점 (목·어깨·소매끝·밑단 / 허리·밑단) */
  points: Points;
  /** 품(너비)·기장 배율. 1 = 기본 */
  fit: { width: number; length: number };
  source: 'upload' | 'url' | 'code' | 'sample';
}

export interface Garment {
  id: string;
  name: string;
  category: Category;
  shape: Shape;
  color: string;
  /** 일러스트 채움색 */
  hex: string;
  seasons: Season[];
  loc: Loc | null;
  brand?: string;
  size?: string;
  material?: string;
  memo?: string;
  /** 보온 정도 1(얇음)~5(매우 따뜻함), 신발·소품은 0. 날씨 추천에 쓴다. */
  warmth: number;
  care?: Care;
  /** 사진으로 등록한 옷이면 있다. 없으면 일러스트로 보여 준다 */
  photo?: Photo;
  createdAt: number;
}

export type SpaceKind = '걸기' | '서랍' | '선반' | '상자' | '집 밖';
export const SPACE_KINDS: SpaceKind[] = ['걸기', '서랍', '선반', '상자', '집 밖'];

export interface Space {
  name: string;
  kind: SpaceKind;
  /** 수용 개수 (옷 몇 벌까지 두는지) */
  capacity: number;
  /** 칸 이름. 비어 있으면 공간 전체가 하나의 칸이다. */
  slots: string[];
}

export type StatusLabel = '보관 중' | '세탁 중' | '수선 중' | '미배치';
export const STATUSES: StatusLabel[] = ['보관 중', '세탁 중', '수선 중', '미배치'];

/** 세탁·수선 중 여부는 저장하지 않고 care 기록에서 계산한다 (계획서 R08·R09). */
export function statusOf(g: Garment): StatusLabel {
  if (g.care) return g.care.kind === '세탁' ? '세탁 중' : '수선 중';
  if (!g.loc) return '미배치';
  return '보관 중';
}

export function isoDay(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isOverdue(g: Garment): boolean {
  return !!g.care && g.care.due < isoDay(0);
}

export function dueLabel(due: string): string {
  const diff = Math.round((new Date(due).getTime() - new Date(isoDay(0)).getTime()) / 86400000);
  if (diff === 0) return '오늘 회수 예정';
  if (diff === 1) return '내일 회수 예정';
  if (diff > 1) return `${diff}일 뒤 회수 예정`;
  return `${-diff}일 지남`;
}

export function fmtLoc(loc: Loc | null, sep = ' · '): string {
  if (!loc) return '미배치';
  return loc.slot ? `${loc.space}${sep}${loc.slot}` : loc.space;
}

const COLOR_HEX: Record<string, string> = {
  화이트: '#F2F1EE', 아이보리: '#EDE5D3', 베이지: '#D5BC95', 브라운: '#B98252', 카멜: '#C9A57B',
  블랙: '#2A2B2F', 차콜: '#4B4D54', 그레이: '#8D9096', 네이비: '#33497A', 블루: '#6F9BD6',
  하늘색: '#A9C6E8', 민트: '#A9D8CB', 카키: '#8A9A72', 그린: '#6E9A6E', 옐로: '#EDCB62',
  오렌지: '#E38B4B', 올리브: '#5E6350', 다크카키: '#54523F', 카키그레이: '#6C6C5E', 다크브라운: '#4A382E', 레드: '#C8504A', 핑크: '#F0B3B3', 버건디: '#7C2F3E', 퍼플: '#8F78B8',
};
export function colorHex(name: string, fallback = '#C9C4BA'): string {
  return COLOR_HEX[name.trim()] ?? fallback;
}
