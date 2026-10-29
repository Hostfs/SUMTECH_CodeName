// 코디 화면이 쓰는 타입과 작은 계산. 서버(/api/outfits)와 같은 규칙: 지금 입을 수 있는 옷은 집 안에 있고 사용 가능한 옷뿐이다.
import type { GarmentSummary } from '../types'

export type Slot = 'OUTER' | 'TOP' | 'BOTTOM' | 'DRESS'
export const SLOTS: Slot[] = ['OUTER', 'TOP', 'BOTTOM', 'DRESS']
export const SLOT_LABEL: Record<Slot, string> = { OUTER: '아우터', TOP: '상의', BOTTOM: '하의', DRESS: '원피스' }
/** 말풍선은 모형 양옆에 두어 몸을 가리지 않는다(초안: 아우터·신발 왼쪽, 상의·하의 오른쪽 → 신발 자리에 원피스) */
export const SLOT_SIDE: Record<Slot, 'left' | 'right'> = { OUTER: 'left', TOP: 'right', BOTTOM: 'right', DRESS: 'left' }
/** 마네킹에 겹쳐 그리는 순서: 하의 → 원피스 → 상의 → 아우터 */
export const LAYER_ORDER: Slot[] = ['BOTTOM', 'DRESS', 'TOP', 'OUTER']

export type OutfitItem = { slot: Slot; garment: GarmentSummary }
export type OutfitLook = {
  id: number
  name: string
  createdAt: string
  items: OutfitItem[]
  wearableNow: boolean
  awayItems: string[]
}
export type OutfitSuggestion = { season: string; seasonLabel: string; items: OutfitItem[]; reason: string }

export type Picks = Partial<Record<Slot, GarmentSummary>>

/** 지금 바로 꺼내 입을 수 있는지(집 안 자리 + 사용 가능). */
export const wearableNow = (g: GarmentSummary) => g.locationKind === 'HOME' && g.usable

/** 코디 자리에 들어갈 수 있는 종류인지(기타는 자리가 없다). */
export const slotOf = (g: GarmentSummary): Slot | null => (SLOTS as string[]).includes(g.category) ? (g.category as Slot) : null

/** 지금 어디에 있는지 한 줄로. 집 안이면 경로만, 아니면 왜 바로 못 꺼내는지 앞에 붙인다. */
export function whereNow(g: GarmentSummary): string {
  if (g.locationKind === 'CARE') return g.statusLabel
  if (g.locationKind === 'UNPLACED') return '자리 미확인'
  if (g.locationKind === 'HOME') return g.usable ? g.locationPath ?? '집 안' : `${g.statusLabel} · ${g.locationPath ?? '집 안'}`
  return `${g.locationKindLabel}${g.locationPath ? ` · ${g.locationPath}` : ''}`
}

/** 한 자리에 옷을 입히거나(g) 비운다(null). 원피스는 상의·하의와 함께 입지 않는다. */
export function choose(picks: Picks, slot: Slot, g: GarmentSummary | null): Picks {
  const next: Picks = { ...picks }
  if (!g) {
    delete next[slot]
    return next
  }
  next[slot] = g
  if (slot === 'DRESS') {
    delete next.TOP
    delete next.BOTTOM
  } else if (slot === 'TOP' || slot === 'BOTTOM') {
    delete next.DRESS
  }
  return next
}

export const picksFrom = (items: OutfitItem[]): Picks => Object.fromEntries(items.map((i) => [i.slot, i.garment]))
export const pickedItems = (picks: Picks): OutfitItem[] =>
  SLOTS.filter((s) => picks[s]).map((s) => ({ slot: s, garment: picks[s]! }))

/** 받침이 있으면 '을', 없으면 '를' (초안 lib/josa) */
export function eul(word: string): string {
  const c = word.charCodeAt(word.length - 1)
  if (c < 0xac00 || c > 0xd7a3) return `${word}을(를)`
  return `${word}${(c - 0xac00) % 28 ? '을' : '를'}`
}
