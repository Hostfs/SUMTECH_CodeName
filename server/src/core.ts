import { inList, one, query, run } from './db.js'
import {
  CareType, CarePlace, Category, ClothingTemplate, GarmentStatus, LocationKind, Season, SpaceType, SubType,
  type CareType as CareTypeCode, type CarePlace as CarePlaceCode, type Fiber, type GarmentField, type MaterialPart,
  type MeasurementKind, type MeasurementPart, type Season as SeasonCode, type SpaceType as SpaceTypeCode,
  type SubType as SubTypeCode, type WearFrequency,
} from './domain.js'
import { instant } from './dates.js'
import { ApiError } from './http.js'

// 여러 화면·API가 함께 쓰는 옷·공간·세탁 기록의 읽기와 계산(Spring의 Garment·ClosetContext·GarmentService 공통 부분).

export interface Material { part: MaterialPart; fiber: Fiber; percent: number }
export interface CareLine { lineNo: number; instruction: string }
export interface Measurement { part: MeasurementPart; kind: MeasurementKind; valueCm: number; source: string | null; confirmed: boolean }

/** 사용자 소유의 실물 한 벌(garments)과 딸린 목록. */
export interface Garment {
  id: number
  userId: number
  name: string
  brand: string | null
  productCode: string | null
  colorName: string | null
  colorHex: string | null
  sizeLabel: string | null
  origin: string | null
  subType: SubTypeCode
  wearFrequency: WearFrequency
  /** 사용자가 정하는 집 안 상태만(보관 중·착용·보관 전·세탁 대기). */
  homeStatus: GarmentStatus
  usableWhenPending: boolean
  createdAt: Date
  updatedAt: Date
  seasons: SeasonCode[]
  collectionIds: number[]
  aiFields: GarmentField[]
  materials: Material[]
  careLines: CareLine[]
  measurements: Measurement[]
}

export interface CareEvent {
  id: number
  garmentId: number
  careType: CareTypeCode
  place: CarePlaceCode
  shopName: string | null
  description: string | null
  droppedOn: string
  dueOn: string | null
  completedAt: Date | null
  createdAt: Date
}

export interface Placement { garmentId: number; spaceId: number; placedAt: Date }

export interface StorageSpace { id: number; userId: number; name: string; spaceType: SpaceTypeCode; capacity: number | null; createdAt: Date }

const GARMENT_COLS = 'id, user_id, name, brand, product_code, color_name, color_hex, size_label, origin, sub_type_code, wear_frequency_code, status_code, usable_when_pending, created_at, updated_at'

function groupBy<T extends { garment_id: number }>(rows: T[]) {
  const m = new Map<number, T[]>()
  for (const r of rows) {
    const list = m.get(r.garment_id)
    if (list) list.push(r)
    else m.set(r.garment_id, [r])
  }
  return m
}

/** garments 행과 딸린 목록 6개를 읽어 옷 객체로 만든다. */
async function hydrate(rows: any[]): Promise<Garment[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const p = inList(ids)
  const [seasons, collections, aiFields, materials, careLines, measurements] = await Promise.all([
    query('SELECT garment_id, season_code FROM garment_seasons WHERE garment_id IN (?)', p),
    query('SELECT garment_id, collection_id FROM garment_collections WHERE garment_id IN (?)', p),
    query('SELECT garment_id, field_code FROM garment_ai_fields WHERE garment_id IN (?)', p),
    query('SELECT garment_id, part_code, fiber_code, percent FROM garment_materials WHERE garment_id IN (?)', p),
    query('SELECT garment_id, line_no, instruction FROM garment_care_instructions WHERE garment_id IN (?)', p),
    query('SELECT garment_id, part_code, kind_code, value_cm, source, confirmed FROM garment_measurements WHERE garment_id IN (?)', p),
  ]).then((all) => all.map((r) => groupBy(r as any[])))
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    brand: r.brand,
    productCode: r.product_code,
    colorName: r.color_name,
    colorHex: r.color_hex,
    sizeLabel: r.size_label,
    origin: r.origin,
    subType: r.sub_type_code,
    wearFrequency: r.wear_frequency_code,
    homeStatus: r.status_code,
    usableWhenPending: Boolean(r.usable_when_pending),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    seasons: (seasons.get(r.id) ?? []).map((x) => x.season_code),
    collectionIds: (collections.get(r.id) ?? []).map((x) => x.collection_id),
    aiFields: (aiFields.get(r.id) ?? []).map((x) => x.field_code),
    materials: (materials.get(r.id) ?? []).map((x) => ({ part: x.part_code, fiber: x.fiber_code, percent: Number(x.percent) })),
    careLines: (careLines.get(r.id) ?? []).map((x) => ({ lineNo: x.line_no, instruction: x.instruction })),
    measurements: (measurements.get(r.id) ?? []).map((x) => ({
      part: x.part_code, kind: x.kind_code, valueCm: Number(x.value_cm), source: x.source, confirmed: Boolean(x.confirmed),
    })),
  }))
}

/** 한 사용자의 옷 전체(최근 등록순). */
export async function loadGarments(userId: number): Promise<Garment[]> {
  return hydrate(await query(`SELECT ${GARMENT_COLS} FROM garments WHERE user_id = ? ORDER BY created_at DESC, id DESC`, [userId]))
}

/** 내 옷 한 벌. 없거나 남의 옷이면 404. */
export async function owned(userId: number, garmentId: number): Promise<Garment> {
  const rows = await query(`SELECT ${GARMENT_COLS} FROM garments WHERE id = ? AND user_id = ?`, [garmentId, userId])
  const [g] = await hydrate(rows)
  if (!g) throw ApiError.notFound('옷')
  return g
}

/**
 * 옷 행과 딸린 목록을 저장한다(있으면 고치고 없으면 만든다). 딸린 목록은 지우고 다시 넣는다(JPA ElementCollection과 같다).
 * 새 옷이면 g.id를 채운다.
 */
export async function saveGarment(g: Garment): Promise<Garment> {
  const values = [g.name, g.brand, g.productCode, g.colorName, g.colorHex, g.sizeLabel, g.origin, g.subType, g.wearFrequency,
    g.homeStatus, g.usableWhenPending ? 1 : 0, g.updatedAt]
  if (!g.id) {
    const r = await run(`INSERT INTO garments (user_id, name, brand, product_code, color_name, color_hex, size_label, origin, sub_type_code,
      wear_frequency_code, status_code, usable_when_pending, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [g.userId, ...values, g.createdAt])
    g.id = r.insertId
  } else {
    await run(`UPDATE garments SET name = ?, brand = ?, product_code = ?, color_name = ?, color_hex = ?, size_label = ?, origin = ?,
      sub_type_code = ?, wear_frequency_code = ?, status_code = ?, usable_when_pending = ?, updated_at = ? WHERE id = ?`, [...values, g.id])
    await Promise.all(['garment_seasons', 'garment_collections', 'garment_ai_fields', 'garment_materials', 'garment_care_instructions', 'garment_measurements']
      .map((t) => run(`DELETE FROM ${t} WHERE garment_id = ?`, [g.id])))
  }
  const id = g.id
  if (g.seasons.length) await run('INSERT INTO garment_seasons (garment_id, season_code) VALUES ?', [[...new Set(g.seasons)].map((s) => [id, s])])
  if (g.collectionIds.length) await run('INSERT INTO garment_collections (garment_id, collection_id) VALUES ?', [[...new Set(g.collectionIds)].map((c) => [id, c])])
  if (g.aiFields.length) await run('INSERT INTO garment_ai_fields (garment_id, field_code) VALUES ?', [[...new Set(g.aiFields)].map((f) => [id, f])])
  if (g.materials.length) await run('INSERT INTO garment_materials (garment_id, part_code, fiber_code, percent) VALUES ?', [g.materials.map((m) => [id, m.part, m.fiber, m.percent])])
  if (g.careLines.length) await run('INSERT INTO garment_care_instructions (garment_id, line_no, instruction) VALUES ?', [g.careLines.map((c) => [id, c.lineNo, c.instruction])])
  if (g.measurements.length) {
    await run('INSERT INTO garment_measurements (garment_id, part_code, kind_code, value_cm, source, confirmed) VALUES ?',
      [g.measurements.map((m) => [id, m.part, m.kind, m.valueCm, m.source, m.confirmed ? 1 : 0])])
  }
  return g
}

/** updated_at만 지금으로. */
export async function touch(garmentId: number) {
  await run('UPDATE garments SET updated_at = ? WHERE id = ?', [new Date(), garmentId])
}

export function newGarment(userId: number): Garment {
  const now = new Date()
  return {
    id: 0, userId, name: '', brand: null, productCode: null, colorName: null, colorHex: null, sizeLabel: null, origin: null,
    subType: 'ETC', wearFrequency: 'MEDIUM', homeStatus: 'STORED', usableWhenPending: false, createdAt: now, updatedAt: now,
    seasons: [], collectionIds: [], aiFields: [], materials: [], careLines: [], measurements: [],
  }
}

/** 3D 코디에 쓰던 총장(cm). 치수 테이블의 (총장, 길이) 행. */
export function totalLengthCm(g: Garment): number | null {
  return g.measurements.find((m) => m.part === 'TOTAL_LENGTH' && m.kind === 'LENGTH')?.valueCm ?? null
}

// ---------- 세탁·수선 기록 ----------

export function careFromRow(r: any): CareEvent {
  return {
    id: r.id, garmentId: r.garment_id, careType: r.care_type_code, place: r.place_code, shopName: r.shop_name,
    description: r.description, droppedOn: r.dropped_on, dueOn: r.due_on, completedAt: r.completed_at, createdAt: r.created_at,
  }
}

const CARE_COLS = 'c.id, c.garment_id, c.care_type_code, c.place_code, c.shop_name, c.description, c.dropped_on, c.due_on, c.completed_at, c.created_at'

/** 한 사용자의 세탁·수선 기록 전체(회수 예정일, ID 순. 예정일 없는 것이 먼저). */
export async function careByOwner(userId: number): Promise<CareEvent[]> {
  return (await query(`SELECT ${CARE_COLS} FROM care_events c JOIN garments g ON g.id = c.garment_id WHERE g.user_id = ? ORDER BY c.due_on, c.id`, [userId])).map(careFromRow)
}

/** 그 옷의 진행 중(회수 전) 기록. */
export async function openCareOf(garmentId: number): Promise<CareEvent | undefined> {
  const r = await one(`SELECT ${CARE_COLS} FROM care_events c WHERE c.garment_id = ? AND c.completed_at IS NULL ORDER BY c.id LIMIT 1`, [garmentId])
  return r ? careFromRow(r) : undefined
}

/** 세탁·수선 기록을 새로 만든다. id를 채워 돌려준다. */
export async function insertCare(c: Omit<CareEvent, 'id' | 'createdAt' | 'completedAt'> & { completedAt?: Date | null; createdAt?: Date }): Promise<CareEvent> {
  const createdAt = c.createdAt ?? new Date()
  const r = await run(`INSERT INTO care_events (garment_id, care_type_code, place_code, shop_name, description, dropped_on, due_on, completed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [c.garmentId, c.careType, c.place, c.shopName, c.description, c.droppedOn, c.dueOn, c.completedAt ?? null, createdAt])
  return { ...c, id: r.insertId, completedAt: c.completedAt ?? null, createdAt }
}

export function careView(c: CareEvent) {
  return {
    id: c.id, careType: c.careType, careTypeLabel: CareType.label(c.careType), place: c.place, placeLabel: CarePlace.label(c.place),
    shopName: c.shopName, description: c.description, droppedOn: c.droppedOn, dueOn: c.dueOn, completedAt: instant(c.completedAt),
  }
}

// ---------- 공간·위치 ----------

export const SEPARATOR = ' → '

export function spaceFromRow(r: any): StorageSpace {
  return { id: r.id, userId: r.user_id, name: r.name, spaceType: r.space_type_code, capacity: r.capacity, createdAt: r.created_at }
}

/** 한 사용자의 공간(ID 순). */
export async function spacesOf(userId: number): Promise<StorageSpace[]> {
  return (await query('SELECT id, user_id, name, space_type_code, capacity, created_at FROM storage_spaces WHERE user_id = ? ORDER BY id', [userId])).map(spaceFromRow)
}

export async function ownedSpace(userId: number, spaceId: number): Promise<StorageSpace | undefined> {
  const r = await one('SELECT id, user_id, name, space_type_code, capacity, created_at FROM storage_spaces WHERE id = ? AND user_id = ?', [spaceId, userId])
  return r ? spaceFromRow(r) : undefined
}

/** 공간 ID → 상위 공간 ID. */
export async function parentMap(userId: number): Promise<Map<number, number>> {
  const rows = await query(`SELECT p.space_id, p.parent_space_id FROM storage_space_parents p JOIN storage_spaces s ON s.id = p.space_id WHERE s.user_id = ?`, [userId])
  return new Map(rows.map((r) => [r.space_id, r.parent_space_id]))
}

export function pathOf(id: number, names: Map<number, string>, parentOf: Map<number, number>): string {
  const parts: string[] = []
  let current: number | undefined = id
  // 순환이 있더라도 멈추도록 깊이를 제한한다(서버는 순환을 만들지 않는다).
  for (let depth = 0; current !== undefined && depth < 10; depth++) {
    parts.push(names.get(current)!)
    current = parentOf.get(current)
  }
  return parts.reverse().join(SEPARATOR)
}

/** 한 사용자의 공간 ID → '옷장 A → 왼쪽 행거' 경로. */
export async function locationPaths(userId: number): Promise<Map<number, string>> {
  const [spaces, parents] = await Promise.all([spacesOf(userId), parentMap(userId)])
  const names = new Map(spaces.map((s) => [s.id, s.name]))
  return new Map(spaces.map((s) => [s.id, pathOf(s.id, names, parents)]))
}

/** '본가 → 안방 옷장'처럼 박스·집 밖 아래에 만든 공간은 가장 가까운 박스·집 밖 유형을 따른다. */
export function awayAware(own: Map<number, SpaceTypeCode>, parentOf: Map<number, number>): Map<number, SpaceTypeCode> {
  const types = new Map<number, SpaceTypeCode>()
  for (const [id, type] of own) {
    let t = type
    let current = parentOf.get(id)
    // 순환이 있더라도 멈추도록 깊이를 제한한다(경로 계산과 같은 규칙).
    for (let depth = 0; current !== undefined && depth < 10 && t !== 'BOX' && t !== 'OFFSITE'; depth++) {
      const up = own.get(current)
      if (up === 'BOX' || up === 'OFFSITE') t = up
      current = parentOf.get(current)
    }
    types.set(id, t)
  }
  return types
}

/** 옷은 가장 안쪽 공간에만 넣는다('옷장 A'가 아니라 '옷장 A → 왼쪽 행거'). */
export async function requireLeafSpace(userId: number, spaceId: number) {
  if (!(await ownedSpace(userId, spaceId))) throw ApiError.notFound('공간')
  for (const parent of (await parentMap(userId)).values()) {
    if (parent === spaceId) throw ApiError.badRequest('안쪽에 다른 공간이 있는 곳이에요. 가장 안쪽 공간을 골라 주세요.')
  }
}

/** 확정 위치를 쓴다(있으면 바꾸고 없으면 만든다). */
export async function place(garmentId: number, spaceId: number) {
  await run(`INSERT INTO garment_placements (garment_id, space_id, placed_at) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE space_id = VALUES(space_id), placed_at = VALUES(placed_at)`, [garmentId, spaceId, new Date()])
}

/** 옷장 지도에서 고른 옷을 고른 공간에 바로 넣는다(추천을 거치지 않음). 세탁·수선 중인 옷은 넣을 수 없다. */
export async function placeDirectly(userId: number, spaceId: number, garmentIds: number[] | null | undefined) {
  if (!garmentIds || !garmentIds.length) throw ApiError.badRequest('넣을 옷을 골라 주세요.')
  await requireLeafSpace(userId, spaceId)
  const ctx = await loadContext(userId)
  for (const garmentId of new Set(garmentIds)) {
    const g = await owned(userId, garmentId)
    if (GarmentStatus.isAway(ctx.status(g))) {
      throw ApiError.conflict(`'${g.name}'은(는) 세탁·수선 중이라 회수 완료 후에 넣을 수 있어요.`)
    }
    await place(g.id, spaceId)
    await touch(g.id)
  }
}

// ---------- 옷장 계산(저장하지 않는 값) ----------

/**
 * 한 사용자의 옷장을 보여 줄 때 필요한 연결 정보를 한 번에 읽은 것.
 * 현재 상태·위치 경로·사용 가능 여부처럼 저장하지 않는 값은 여기서 계산한다(docs/db/ERD.md 5절).
 */
export class ClosetContext {
  constructor(
    readonly paths: Map<number, string>,
    readonly spaceTypes: Map<number, SpaceTypeCode>,
    readonly placements: Map<number, Placement>,
    readonly openCare: Map<number, CareEvent>,
    readonly lastReturned: Map<number, Date>,
    readonly covers: Map<number, number>,
    readonly collectionNames: Map<number, string>,
  ) {}

  /** ① 진행 중 세탁·수선 ② 회수 후 위치 확정 전 ③ 사용자가 정한 집 안 상태 */
  status(g: Garment): GarmentStatus {
    const open = this.openCare.get(g.id)
    if (open) return CareType.garmentStatus(open.careType)
    const returned = this.lastReturned.get(g.id)
    const placement = this.placements.get(g.id)
    if (returned && (!placement || returned.getTime() > placement.placedAt.getTime())) return 'RETURNED_UNPLACED'
    return g.homeStatus
  }

  /** 그 위치에 실제로 있다고 말할 수 있는지. 집에 없거나 회수 후 확인 전이면 아니다. */
  locationConfirmed(g: Garment): boolean {
    const s = this.status(g)
    return this.placements.has(g.id) && !GarmentStatus.isAway(s) && s !== 'RETURNED_UNPLACED'
  }

  /** 기본 코디 추천 후보가 될 수 있는지. 세탁 대기·세탁 중·수선 중은 제외한다. */
  usable(g: Garment): boolean {
    switch (this.status(g)) {
      case 'STORED': case 'RETURNED_UNPLACED': return true
      case 'PENDING': return g.usableWhenPending
      default: return false
    }
  }

  /** 집 안·박스 속·집 밖·세탁소·미배치 중 어디인지. */
  locationKind(g: Garment): LocationKind {
    if (GarmentStatus.isAway(this.status(g))) return 'CARE'
    if (!this.locationConfirmed(g)) return 'UNPLACED'
    switch (this.spaceTypes.get(this.placements.get(g.id)!.spaceId)) {
      case 'BOX': return 'BOX'
      case 'OFFSITE': return 'OFFSITE'
      default: return 'HOME'
    }
  }

  /** 위치가 정해지지 않았고 집에 있는 옷. */
  needsPlacement(g: Garment): boolean {
    return !this.placements.has(g.id) && !GarmentStatus.isAway(this.status(g))
  }
}

export async function loadContext(userId: number): Promise<ClosetContext> {
  const [placementRows, cares, coverRows, collectionRows, spaces, parents, paths] = await Promise.all([
    query('SELECT p.garment_id, p.space_id, p.placed_at FROM garment_placements p JOIN garments g ON g.id = p.garment_id WHERE g.user_id = ?', [userId]),
    careByOwner(userId),
    query('SELECT c.garment_id, c.image_id FROM garment_cover_images c JOIN garments g ON g.id = c.garment_id WHERE g.user_id = ?', [userId]),
    query('SELECT id, name FROM collections WHERE user_id = ? ORDER BY name', [userId]),
    spacesOf(userId),
    parentMap(userId),
    locationPaths(userId),
  ])
  const placements = new Map<number, Placement>(placementRows.map((r) => [r.garment_id, { garmentId: r.garment_id, spaceId: r.space_id, placedAt: r.placed_at }]))
  const open = new Map<number, CareEvent>()
  const returned = new Map<number, Date>()
  for (const c of cares) {
    if (!c.completedAt) open.set(c.garmentId, c)
    else {
      const prev = returned.get(c.garmentId)
      if (!prev || c.completedAt > prev) returned.set(c.garmentId, c.completedAt)
    }
  }
  const covers = new Map<number, number>(coverRows.map((r) => [r.garment_id, r.image_id]))
  const names = new Map<number, string>(collectionRows.map((r) => [r.id, r.name]))
  const types = awayAware(new Map(spaces.map((s) => [s.id, s.spaceType])), parents)
  return new ClosetContext(paths, types, placements, open, returned, covers, names)
}

export const imageUrl = (id: number | null | undefined) => (id == null ? null : `/api/images/${id}`)

/** 목록·카드에 쓰는 옷 요약(GarmentSummary). */
export function summary(g: Garment, ctx: ClosetContext) {
  const template = SubType.template(g.subType)
  const category = SubType.category(g.subType)
  const status = ctx.status(g)
  const placement = ctx.placements.get(g.id)
  const kind = ctx.locationKind(g)
  return {
    id: g.id,
    name: g.name,
    brand: g.brand,
    colorName: g.colorName,
    colorHex: g.colorHex,
    category,
    categoryLabel: Category.label(category),
    subType: g.subType,
    subTypeLabel: SubType.label(g.subType),
    template,
    templateLabel: template ? ClothingTemplate.label(template) : null,
    seasons: [...g.seasons].sort((a, b) => Season.ordinal(a) - Season.ordinal(b)),
    collections: g.collectionIds.map((id) => ctx.collectionNames.get(id)).filter((v): v is string => v != null).sort(),
    status,
    statusLabel: GarmentStatus.label(status),
    usable: ctx.usable(g),
    wearFrequency: g.wearFrequency,
    spaceId: placement ? placement.spaceId : null,
    locationPath: ctx.locationConfirmed(g) ? ctx.paths.get(placement!.spaceId) ?? null : null,
    locationKind: kind,
    locationKindLabel: LocationKind.label(kind),
    imageUrl: imageUrl(ctx.covers.get(g.id)),
    totalLengthCm: totalLengthCm(g),
  }
}

export type GarmentSummary = ReturnType<typeof summary>

export { SpaceType }
