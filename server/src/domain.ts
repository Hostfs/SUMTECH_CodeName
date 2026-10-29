// 도메인 값. 각 값은 같은 이름의 도메인 테이블 code와 같다. 배열 순서가 Java enum 순서(정렬 기준)다.

type Labels<K extends string> = Record<K, string>

function order<K extends string>(labels: Labels<K>) {
  const keys = Object.keys(labels) as K[]
  return { keys, label: (k: K) => labels[k], ordinal: (k: K) => keys.indexOf(k), has: (v: unknown): v is K => typeof v === 'string' && keys.includes(v as K) }
}

export type Category = 'TOP' | 'BOTTOM' | 'OUTER' | 'DRESS' | 'ETC'
export const Category = order<Category>({ TOP: '상의', BOTTOM: '하의', OUTER: '아우터', DRESS: '원피스', ETC: '기타' })

export type ClothingTemplate = 'SHORT_SLEEVE_TOP' | 'LONG_SLEEVE_TOP' | 'JACKET' | 'LONG_PANTS'
export const ClothingTemplate = order<ClothingTemplate>({ SHORT_SLEEVE_TOP: '반소매 상의', LONG_SLEEVE_TOP: '긴소매 상의', JACKET: '재킷', LONG_PANTS: '긴바지' })

export type SubType = 'SHORT_SLEEVE_TEE' | 'LONG_SLEEVE_TEE' | 'SHIRT' | 'KNIT' | 'TOP_ETC' | 'JACKET' | 'COAT' | 'OUTER_ETC'
  | 'PANTS' | 'JEANS' | 'SHORTS' | 'SKIRT' | 'BOTTOM_ETC' | 'DRESS' | 'ETC'
const SUB_TYPES: Record<SubType, [string, Category, ClothingTemplate | null]> = {
  SHORT_SLEEVE_TEE: ['반소매 티셔츠', 'TOP', 'SHORT_SLEEVE_TOP'],
  LONG_SLEEVE_TEE: ['긴소매 티셔츠', 'TOP', 'LONG_SLEEVE_TOP'],
  SHIRT: ['셔츠', 'TOP', 'LONG_SLEEVE_TOP'],
  KNIT: ['니트', 'TOP', 'LONG_SLEEVE_TOP'],
  TOP_ETC: ['기타 상의', 'TOP', null],
  JACKET: ['재킷', 'OUTER', 'JACKET'],
  COAT: ['코트', 'OUTER', null],
  OUTER_ETC: ['기타 아우터', 'OUTER', null],
  PANTS: ['바지', 'BOTTOM', 'LONG_PANTS'],
  JEANS: ['청바지', 'BOTTOM', 'LONG_PANTS'],
  SHORTS: ['반바지', 'BOTTOM', null],
  SKIRT: ['치마', 'BOTTOM', null],
  BOTTOM_ETC: ['기타 하의', 'BOTTOM', null],
  DRESS: ['원피스', 'DRESS', null],
  ETC: ['기타', 'ETC', null],
}
export const SubType = {
  ...order<SubType>(Object.fromEntries(Object.entries(SUB_TYPES).map(([k, v]) => [k, v[0]])) as Labels<SubType>),
  category: (s: SubType) => SUB_TYPES[s][1],
  template: (s: SubType) => SUB_TYPES[s][2],
}

export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER'
export const Season = order<Season>({ SPRING: '봄', SUMMER: '여름', AUTUMN: '가을', WINTER: '겨울' })

export type WearFrequency = 'HIGH' | 'MEDIUM' | 'LOW'
export const WearFrequency = order<WearFrequency>({ HIGH: '자주', MEDIUM: '보통', LOW: '가끔' })

export type GarmentStatus = 'STORED' | 'PENDING' | 'WASH_WAITING' | 'WASHING' | 'REPAIRING' | 'RETURNED_UNPLACED'
export const GarmentStatus = {
  ...order<GarmentStatus>({ STORED: '보관 중', PENDING: '착용·보관 전', WASH_WAITING: '세탁 대기', WASHING: '세탁 중', REPAIRING: '수선 중', RETURNED_UNPLACED: '회수 완료·위치 미확인' }),
  /** 사용자가 직접 정해 저장하는 상태인지. */
  isHome: (s: GarmentStatus) => s === 'STORED' || s === 'PENDING' || s === 'WASH_WAITING',
  /** 실물이 집에 없는 상태. */
  isAway: (s: GarmentStatus) => s === 'WASHING' || s === 'REPAIRING',
}

export type LocationKind = 'HOME' | 'BOX' | 'OFFSITE' | 'CARE' | 'UNPLACED'
export const LocationKind = order<LocationKind>({ HOME: '집 안', BOX: '박스 속', OFFSITE: '집 밖', CARE: '세탁·수선 맡김', UNPLACED: '미배치' })

export type SpaceType = 'HANG' | 'FOLD' | 'LONG_TERM' | 'BOX' | 'OFFSITE'
export const SpaceType = order<SpaceType>({ HANG: '걸기', FOLD: '접기', LONG_TERM: '장기보관', BOX: '박스', OFFSITE: '집 밖' })

export type CareType = 'WASH' | 'REPAIR'
export const CareType = {
  ...order<CareType>({ WASH: '세탁', REPAIR: '수선' }),
  garmentStatus: (c: CareType): GarmentStatus => (c === 'WASH' ? 'WASHING' : 'REPAIRING'),
}

export type CarePlace = 'HOME' | 'SHOP'
export const CarePlace = order<CarePlace>({ HOME: '자택', SHOP: '업체' })

export type GarmentField = 'NAME' | 'BRAND' | 'PRODUCT_CODE' | 'COLOR' | 'SIZE_LABEL' | 'ORIGIN' | 'SUB_TYPE' | 'MATERIAL' | 'CARE' | 'SEASONS'
export const GarmentField = order<GarmentField>({
  NAME: '옷 이름', BRAND: '브랜드', PRODUCT_CODE: '품번', COLOR: '색상', SIZE_LABEL: '표기 사이즈',
  ORIGIN: '원산지', SUB_TYPE: '세부 종류', MATERIAL: '소재', CARE: '세탁·관리', SEASONS: '계절',
})

export type MaterialPart = 'SHELL' | 'LINING' | 'TRIM' | 'FILL'
export const MaterialPart = order<MaterialPart>({ SHELL: '겉감', LINING: '안감', TRIM: '배색', FILL: '충전재' })

export type Fiber = 'COTTON' | 'POLYESTER' | 'WOOL' | 'ACRYLIC' | 'NYLON' | 'RAYON' | 'POLYURETHANE' | 'LINEN' | 'SILK'
  | 'CASHMERE' | 'VISCOSE' | 'MODAL' | 'LYOCELL' | 'LEATHER' | 'DOWN' | 'FEATHER' | 'OTHER'
export const Fiber = order<Fiber>({
  COTTON: '면', POLYESTER: '폴리에스터', WOOL: '울', ACRYLIC: '아크릴', NYLON: '나일론', RAYON: '레이온',
  POLYURETHANE: '폴리우레탄', LINEN: '마', SILK: '실크', CASHMERE: '캐시미어', VISCOSE: '비스코스',
  MODAL: '모달', LYOCELL: '라이오셀', LEATHER: '가죽', DOWN: '다운', FEATHER: '페더', OTHER: '기타 섬유',
})

export type MeasurementPart = 'TOTAL_LENGTH' | 'SHOULDER' | 'CHEST' | 'SLEEVE' | 'WAIST' | 'HIP' | 'THIGH' | 'RISE' | 'HEM'
export const MeasurementPart = order<MeasurementPart>({
  TOTAL_LENGTH: '총장', SHOULDER: '어깨', CHEST: '가슴', SLEEVE: '소매', WAIST: '허리', HIP: '엉덩이', THIGH: '허벅지', RISE: '밑위', HEM: '밑단',
})

export type MeasurementKind = 'SECTION' | 'CIRCUMFERENCE' | 'LENGTH'
export const MeasurementKind = order<MeasurementKind>({ SECTION: '단면', CIRCUMFERENCE: '둘레', LENGTH: '길이' })

/** 이미지 종류는 저장하지 않고 계산한다: 택 사진 → 정리본 → 제품 이미지 → 옷 사진. */
export type ImageKind = 'LABEL' | 'PROCESSED' | 'PRODUCT_ORIGINAL' | 'GARMENT_ORIGINAL'
