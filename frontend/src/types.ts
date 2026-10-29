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
  imageUrl: string | null
  totalLengthCm: number | null
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
  images: { id: number; kind: string; url: string; sourceUrl: string | null }[]
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

export type Body = { heightCm: number | null; shoulderCm: number | null; chestCm: number | null; waistCm: number | null; hipCm: number | null; inseamCm: number | null }
export type Outfit = { id: number; name: string; top: GarmentSummary | null; bottom: GarmentSummary | null }
export type Recommendation = { top: GarmentSummary; bottom: GarmentSummary; reason: string }
