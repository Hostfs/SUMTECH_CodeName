// 서버 응답 형태(backend의 GarmentDtos 등과 같은 이름).

export type Option = { value: string; label: string }
export type SubTypeOption = Option & { category: string; template: string | null }

export type Meta = {
  categories: Option[]
  clothingTemplates: Option[]
  seasons: Option[]
  garmentStatuses: Option[]
  wearFrequencies: Option[]
  spaceTypes: Option[]
  careTypes: Option[]
  carePlaces: Option[]
  materialParts: Option[]
  fibers: Option[]
  measurementParts: Option[]
  measurementKinds: Option[]
  subTypes: SubTypeOption[]
  currentSeason: string
  today: string
}

export type GarmentSummary = {
  id: number
  name: string
  brand: string | null
  colorName: string | null
  colorHex: string | null
  category: string
  categoryLabel: string
  subType: string
  subTypeLabel: string
  template: string | null
  templateLabel: string | null
  seasons: string[]
  collections: string[]
  status: string
  statusLabel: string
  usable: boolean
  wearFrequency: string
  spaceId: number | null
  locationPath: string | null
  /** HOME 집 안, BOX 박스 속, OFFSITE 집 밖, CARE 세탁·수선 맡김, UNPLACED 미배치 */
  locationKind: 'HOME' | 'BOX' | 'OFFSITE' | 'CARE' | 'UNPLACED'
  locationKindLabel: string
  imageUrl: string | null
  totalLengthCm: number | null
}

/** 옮긴 묶음(F10). destination이 SPACE면 박스·집 밖 공간, LAUNDRY면 세탁소. */
export type MoveBatch = {
  id: number
  createdAt: string
  destination: 'SPACE' | 'LAUNDRY'
  spaceId: number | null
  spacePath: string | null
  spaceType: string | null
  shopName: string | null
  movedOn: string | null
  dueOn: string | null
  garments: GarmentSummary[]
  imageUrls: string[]
}

export type CareView = {
  id: number
  careType: string
  careTypeLabel: string
  place: string
  placeLabel: string
  shopName: string | null
  description: string | null
  droppedOn: string
  dueOn: string | null
  completedAt: string | null
}

export type FieldValue = { field: string; fieldLabel: string; readValue: string | null; correctedValue: string | null; unread: boolean }
export type Extraction = { id: number; rawText: string | null; status: string; errorMessage: string | null; values: FieldValue[]; imageIds: number[] }

export type Candidate = {
  id: number
  name: string
  brand: string | null
  colorName: string | null
  imageUrl: string | null
  sourceUrl: string
  matchReason: string | null
  confirmed?: boolean
}

export type SearchView = { id: number; status: string; searchedAt: string; candidates: Candidate[] }

/** kind: LABEL 택 사진, PROCESSED 정리본, PRODUCT_ORIGINAL 제품 이미지, GARMENT_ORIGINAL 옷 사진.
 *  processing: 원본의 정리 결과(DONE 성공, FAILED 실패해 원본 사용, null 처리 전). */
export type GarmentImage = {
  id: number
  kind: string
  url: string
  sourceUrl: string | null
  processedFromId: number | null
  processing: 'DONE' | 'FAILED' | null
}

export type GarmentDetail = {
  summary: GarmentSummary
  productCode: string | null
  sizeLabel: string | null
  origin: string | null
  homeStatus: string
  usableWhenPending: boolean
  aiFields: string[]
  placedAt: string | null
  materials: { part: string; partLabel: string; fiber: string; fiberLabel: string; percent: number }[]
  careLines: string[]
  measurements: { part: string; partLabel: string; kind: string; kindLabel: string; valueCm: number; source: string | null }[]
  coverImageId: number | null
  images: GarmentImage[]
  extraction: Extraction | null
  search: SearchView | null
  product: { candidateId: number; name: string; brand: string | null; sourceUrl: string; searchedAt: string | null } | null
  careHistory: CareView[]
  suggestedSpaceId: number | null
  suggestedLocationPath: string | null
}

export type SpaceView = {
  id: number
  parentId: number | null
  name: string
  path: string
  spaceType: string
  spaceTypeLabel: string
  capacity: number | null
  count: number
  overBy: number
  garments: GarmentSummary[]
}
export type MapView = { spaces: SpaceView[]; unplaced: GarmentSummary[] }

export type Proposal = {
  id: number
  garment: GarmentSummary
  spaceId: number
  spacePath: string
  reason: string
  capacity: number | null
  projectedCount: number
  overBy: number
}

export type BoardItem = { care: CareView; garment: GarmentSummary; overdue: boolean; dueToday: boolean }
export type Board = { today: string; dueToday: BoardItem[]; overdue: BoardItem[]; inProgress: BoardItem[]; history: BoardItem[] }


/** 현재 위치 날씨(F11). 기상청 초단기실황·단기예보를 서버가 합친 값. 받지 못한 값은 null. */
export type Weather = {
  observedAt: string
  temperature: number | null
  sky: string | null
  precipitation: string
  raining: boolean
  humidity: number | null
  windSpeed: number | null
  minTemperature: number | null
  maxTemperature: number | null
  rainChance: number | null
  /** 기온 기준표로 고른 계절(SPRING 등)과 화면 표기 */
  seasons: string[]
  seasonLabels: string[]
  seasonReason: string
  /** 지금 + 3시간 간격 예보. icon은 sun·partly·cloud·rain·snow·moon */
  hours: { label: string; temperature: number | null; icon: string }[]
}
