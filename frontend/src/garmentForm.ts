// 옷 정보 입력 값과 서버 입력(GarmentInput) 변환. 등록과 수정이 같이 쓴다.

import { nearestColorName } from './colors'

export type MaterialRow = { part: string; fiber: string; percent: string }
export type OtherMeasurement = { part: string; kind: string; valueCm: number; source: string | null }

export type GarmentFormValue = {
  name: string
  subType: string
  brand: string
  productCode: string
  colorName: string
  colorHex: string
  sizeLabel: string
  origin: string
  seasons: string[]
  collections: string
  wearFrequency: string
  materials: MaterialRow[]
  careLines: string
  totalLengthCm: string
  otherMeasurements: OtherMeasurement[]
}

export const emptyForm: GarmentFormValue = {
  name: '', subType: '', brand: '', productCode: '', colorName: '', colorHex: '', sizeLabel: '', origin: '',
  seasons: [], collections: '', wearFrequency: 'MEDIUM', materials: [], careLines: '', totalLengthCm: '', otherMeasurements: [],
}

export function toInput(v: GarmentFormValue) {
  const measurements = [
    ...v.otherMeasurements,
    ...(v.totalLengthCm.trim() ? [{ part: 'TOTAL_LENGTH', kind: 'LENGTH', valueCm: Number(v.totalLengthCm), source: '직접 입력' }] : []),
  ]
  return {
    name: v.name,
    subType: v.subType || null,
    brand: v.brand,
    productCode: v.productCode,
    // 색만 고르고 이름을 비워 두면 가까운 색 이름을 붙여 '미입력'으로 남지 않게 한다.
    colorName: v.colorName.trim() || nearestColorName(v.colorHex) || '',
    colorHex: v.colorHex || null,
    sizeLabel: v.sizeLabel,
    origin: v.origin,
    seasons: v.seasons,
    collections: v.collections.split(',').map((s) => s.trim()).filter(Boolean),
    wearFrequency: v.wearFrequency,
    materials: v.materials.filter((m) => m.part && m.fiber && m.percent).map((m) => ({ part: m.part, fiber: m.fiber, percent: Number(m.percent) })),
    careLines: v.careLines.split('\n').map((s) => s.trim()).filter(Boolean),
    measurements,
  }
}
