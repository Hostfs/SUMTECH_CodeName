// 코디 화면이 쓰는 타입과 작은 계산. 서버(/api/outfits)와 같은 규칙: 지금 입을 수 있는 옷은 집 안에 있고 사용 가능한 옷뿐이다.
import type { GarmentSummary } from '../types'

export type Slot = 'OUTER' | 'TOP' | 'BOTTOM' | 'DRESS'
export const SLOTS: Slot[] = ['OUTER', 'TOP', 'BOTTOM', 'DRESS']
export const SLOT_LABEL: Record<Slot, string> = { OUTER: '아우터', TOP: '상의', BOTTOM: '하의', DRESS: '원피스' }

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

/** 한 자리를 고르거나 다시 눌러 뺀다. 원피스는 상의·하의와 함께 입지 않는다. */
export function toggle(picks: Picks, slot: Slot, g: GarmentSummary): Picks {
  const next: Picks = { ...picks }
  if (next[slot]?.id === g.id) {
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
