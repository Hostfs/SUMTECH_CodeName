import type { Season } from '../lib/seasons';
import type { PhotoKind, Points } from '../lib/cutout';
import samples from './samplePhotos.json';

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

export type SpaceKind = '걸기' | '서랍' | '선반' | '상자';
export const SPACE_KINDS: SpaceKind[] = ['걸기', '서랍', '선반', '상자'];

export interface Space {
  name: string;
  kind: SpaceKind;
  /** 수용 개수 (옷 몇 벌까지 두는지) */
  capacity: number;
  /** 칸 이름. 비어 있으면 공간 전체가 하나의 칸이다. */
  slots: string[];
}

/** 처음 보여 줄 보관 공간. 사용자가 공간을 추가·삭제하면 store 의 spaces 가 쓰인다. */
export const DEFAULT_SPACES: Space[] = [
  { name: '옷장 A', kind: '걸기', capacity: 14, slots: ['왼쪽 행거', '오른쪽 행거', '서랍 1', '서랍 2', '서랍 3'] },
  { name: '옷장 B', kind: '걸기', capacity: 8, slots: ['행거'] },
  { name: '수납 상자 1', kind: '상자', capacity: 8, slots: [] },
  { name: '신발장', kind: '선반', capacity: 6, slots: ['1단', '2단'] },
  { name: '침대 아래', kind: '상자', capacity: 10, slots: ['겨울 박스'] },
];

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

const NOW = Date.now();
const H = 3600_000;

const base = (
  i: number,
  g: Omit<Garment, 'id' | 'createdAt'>,
): Garment => ({ ...g, id: `g${i + 1}`, createdAt: NOW - i * 5 * H });

/** 시안에 있던 옷 + 계획서 시드(세탁 중·수선 중·미배치) 일부 */
export const SEED: Garment[] = [
  // 사용자가 올린 실제 옷 사진 두 장(누끼 + 핏 기준점은 자동 추정). 같은 과정으로 등록하면 이렇게 들어온다.
  {
    id: 'sample-henley', name: 'SUARE 헨리넥 울 니트', category: '상의', shape: 'knit', color: '다크브라운', hex: '#4A382E', seasons: ['가을', '겨울'],
    loc: { space: '수납 상자 1' }, brand: 'SUARE', size: 'M', material: '울', memo: '헨리넥 단추 3개', warmth: 4, createdAt: NOW + 2 * H,
    photo: { src: '/samples/henley-knit.png', w: samples['henley-knit'].w, h: samples['henley-knit'].h, kind: 'top', points: samples['henley-knit'].points as unknown as Points, fit: { width: 1.1, length: 1 }, source: 'sample' },
  },
  {
    id: 'sample-cargo', name: '와이드 카고 팬츠', category: '하의', shape: 'pants', color: '다크카키', hex: '#54523F', seasons: ['봄', '가을'],
    loc: { space: '옷장 B', slot: '행거' }, size: 'M', material: '코튼', memo: '오버핏 와이드 · 지퍼 포켓', warmth: 2, createdAt: NOW + H,
    photo: { src: '/samples/cargo-pants.png', w: samples['cargo-pants'].w, h: samples['cargo-pants'].h, kind: 'bottom', points: samples['cargo-pants'].points as unknown as Points, fit: { width: 1, length: 1 }, source: 'sample' },
  },
  {
    id: 'sample-af1', name: '나이키 에어포스 1 로우', category: '신발', shape: 'sneaker', color: '화이트', hex: '#F2F1EE', seasons: ['봄', '여름', '가을'],
    loc: { space: '신발장', slot: '2단' }, brand: 'Nike', size: '270', material: '가죽', memo: '올화이트 · 데일리', warmth: 0, createdAt: NOW,
    photo: { src: '/samples/air-force-1.png', w: samples['air-force-1'].w, h: samples['air-force-1'].h, kind: 'shoes', points: samples['air-force-1'].points as unknown as Points, fit: { width: 1, length: 1 }, source: 'sample' },
  },
  base(0, { name: '차콜 롱코트', category: '아우터', shape: 'coat', color: '차콜', hex: '#55575E', seasons: ['겨울'], loc: { space: '옷장 A', slot: '오른쪽 행거' }, size: 'M', memo: '한겨울 외출용', warmth: 5 }),
  base(1, { name: '아이보리 니트', category: '상의', shape: 'knit', color: '아이보리', hex: '#EDE5D3', seasons: ['가을', '겨울'], loc: { space: '수납 상자 1' }, size: 'M', warmth: 4 }),
  base(2, { name: '블랙 패딩', category: '아우터', shape: 'puffer', color: '블랙', hex: '#26272B', seasons: ['겨울'], loc: { space: '옷장 B', slot: '행거' }, size: 'L', warmth: 5 }),
  base(3, { name: '그레이 울 팬츠', category: '하의', shape: 'pants', color: '그레이', hex: '#8D9096', seasons: ['가을', '겨울'], loc: { space: '옷장 A', slot: '서랍 3' }, size: '30', material: '울 70%, 폴리 30%', warmth: 4 }),
  base(4, { name: '브라운 니트', category: '상의', shape: 'knit', color: '브라운', hex: '#B98252', seasons: ['가을', '겨울'], loc: { space: '수납 상자 1' }, size: 'M', memo: '두께감 있는 니트', warmth: 4 }),
  base(5, { name: '카멜 롱코트', category: '아우터', shape: 'coat', color: '카멜', hex: '#C9A57B', seasons: ['가을', '겨울'], loc: { space: '옷장 A', slot: '왼쪽 행거' }, size: 'M', warmth: 4 }),
  base(6, { name: '카키 셔츠', category: '상의', shape: 'shirt', color: '카키', hex: '#8A9A72', seasons: ['봄', '가을'], loc: { space: '옷장 A', slot: '왼쪽 행거' }, size: 'M', warmth: 2 }),
  base(7, { name: '차콜 슬랙스', category: '하의', shape: 'pants', color: '차콜', hex: '#3E4046', seasons: ['봄', '가을', '겨울'], loc: { space: '옷장 B', slot: '행거' }, size: '30', warmth: 3 }),
  base(8, { name: '베이지 블레이저', category: '아우터', shape: 'blazer', color: '베이지', hex: '#D5BC95', seasons: ['봄', '가을'], loc: { space: '옷장 A', slot: '왼쪽 행거' }, size: 'M', memo: '모임·면접용', warmth: 3 }),
  base(9, { name: '하늘색 셔츠', category: '상의', shape: 'shirt', color: '하늘색', hex: '#A9C6E8', seasons: ['봄', '여름'], loc: { space: '옷장 A', slot: '서랍 1' }, size: 'M', warmth: 2 }),
  base(10, { name: '아이보리 플리츠 스커트', category: '하의', shape: 'pleated', color: '아이보리', hex: '#EADFC6', seasons: ['봄', '가을'], loc: { space: '옷장 B', slot: '행거' }, size: 'M', warmth: 2 }),
  base(11, { name: '화이트 스니커즈', category: '신발', shape: 'sneaker', color: '화이트', hex: '#EDEDE9', seasons: ['봄', '여름', '가을'], loc: { space: '신발장', slot: '2단' }, size: '270', warmth: 0 }),
  base(12, { name: '화이트 티셔츠', category: '상의', shape: 'tee', color: '화이트', hex: '#F2F1EE', seasons: ['봄', '여름'], loc: { space: '옷장 A', slot: '서랍 1' }, size: 'L', memo: '기본 반팔', warmth: 1 }),
  base(13, { name: '민트 린넨 셔츠', category: '상의', shape: 'shirt', color: '민트', hex: '#A9D8CB', seasons: ['여름'], loc: { space: '옷장 A', slot: '왼쪽 행거' }, size: 'M', material: '린넨 100%', warmth: 1 }),
  base(14, { name: '베이지 반바지', category: '하의', shape: 'shorts', color: '베이지', hex: '#D8C29D', seasons: ['여름'], loc: { space: '옷장 A', slot: '서랍 2' }, size: '30', warmth: 1 }),
  base(15, { name: '네이비 스커트', category: '하의', shape: 'skirt', color: '네이비', hex: '#33497A', seasons: ['봄', '여름', '가을'], loc: { space: '옷장 B', slot: '행거' }, size: 'M', warmth: 2 }),
  base(16, { name: '베이지 니트', category: '상의', shape: 'knit', color: '베이지', hex: '#D8C3A0', seasons: ['가을', '겨울'], loc: { space: '수납 상자 1' }, size: 'M', warmth: 3, care: { kind: '세탁', place: '업체', vendor: '동네 세탁소', since: isoDay(-4), due: isoDay(-1) } }),
  base(17, { name: '연청 데님 팬츠', category: '하의', shape: 'pants', color: '블루', hex: '#8FB0D6', seasons: ['봄', '여름', '가을'], loc: null, size: '30', warmth: 2 }),
  base(18, { name: '카키 치노 팬츠', category: '하의', shape: 'pants', color: '카키', hex: '#A59A6A', seasons: ['봄', '가을'], loc: { space: '옷장 B', slot: '행거' }, size: '30', warmth: 2, care: { kind: '수선', place: '업체', vendor: '수선집', since: isoDay(-3), due: isoDay(0) } }),
  base(19, { name: '블랙 로퍼', category: '신발', shape: 'loafer', color: '블랙', hex: '#2A2B2F', seasons: ['봄', '가을', '겨울'], loc: { space: '신발장', slot: '1단' }, size: '270', warmth: 0 }),
  base(20, { name: '브라운 부츠', category: '신발', shape: 'boots', color: '브라운', hex: '#7A5233', seasons: ['가을', '겨울'], loc: { space: '신발장', slot: '1단' }, size: '270', warmth: 0 }),
];
