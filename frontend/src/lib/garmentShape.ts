// 옷 종류(subType) → 디자인 초안 그림 모양, 색 밝기 조절. GarmentArt와 코디 스튜디오가 함께 쓴다.

export type ArtShape =
  | 'tee' | 'longtee' | 'knit' | 'shirt' | 'coat' | 'blazer' | 'puffer'
  | 'pants' | 'shorts' | 'skirt' | 'pleated' | 'dress'
  | 'loafer' | 'boots' | 'sneaker'

export const FALLBACK = '#d9d3c9'

/** 우리 옷 종류(subType) → 초안 그림 모양 */
const SHAPE_OF: Record<string, ArtShape> = {
  SHORT_SLEEVE_TEE: 'tee', LONG_SLEEVE_TEE: 'longtee', SHIRT: 'shirt', KNIT: 'knit', TOP_ETC: 'tee',
  JACKET: 'blazer', COAT: 'coat', OUTER_ETC: 'puffer',
  PANTS: 'pants', JEANS: 'pants', SHORTS: 'shorts', SKIRT: 'skirt', BOTTOM_ETC: 'pants',
  DRESS: 'dress', ETC: 'sneaker',
}

export const shapeOf = (subType: string): ArtShape => SHAPE_OF[subType] ?? 'tee'

/** hex 를 amt(-1~1) 만큼 어둡게/밝게 */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')
}

