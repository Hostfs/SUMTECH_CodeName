import { Router, type Request } from 'express'
import { inList, one, query, run, tx } from './db.js'
import {
  Fiber, GarmentField, GarmentStatus, MaterialPart, MeasurementKind, MeasurementPart, Season, SubType, WearFrequency,
  type Fiber as FiberCode, type GarmentField as GarmentFieldCode, type GarmentStatus as GarmentStatusCode,
  type ImageKind, type MaterialPart as MaterialPartCode, type MeasurementKind as MeasurementKindCode,
  type MeasurementPart as MeasurementPartCode, type Season as SeasonCode, type SubType as SubTypeCode,
  type WearFrequency as WearFrequencyCode,
} from './domain.js'
import {
  careFromRow, careView, imageUrl, loadContext, loadGarments, newGarment, openCareOf, owned, place, requireLeafSpace,
  saveGarment, summary, touch, type Garment, type GarmentSummary,
} from './core.js'
import { instant } from './dates.js'
import { ApiError, Check, handle, idParam, upload } from './http.js'
import { currentUser } from './session.js'
import { fetchRemoteImage, storeImage } from './images.js'

// GarmentController·GarmentService·GarmentDtos(Spring)와 같은 동작.

// ---------- Java 문자열 규칙 ----------

/** Java String.trim(): 앞뒤의 U+0020 이하 문자만 지운다. */
function javaTrim(s: string): string {
  let a = 0
  let b = s.length
  while (a < b && s.charCodeAt(a) <= 0x20) a++
  while (b > a && s.charCodeAt(b - 1) <= 0x20) b--
  return s.slice(a, b)
}

/** Java Character.isWhitespace (줄바꿈 없는 공백 U+00A0·U+2007·U+202F는 공백이 아니다). */
const JAVA_WS = /^[\t\n\u000B\f\r\u001C-\u001F \u1680\u2000-\u2006\u2008-\u200A\u2028\u2029\u205F\u3000]*$/
const javaIsBlank = (s: string) => JAVA_WS.test(s)

function blankToNull(v: string | null): string | null {
  return v == null || javaIsBlank(v) ? null : javaTrim(v)
}

/** BigDecimal.stripTrailingZeros().toPlainString() (입력은 0.1~100 범위의 보통 소수). */
const plain = (n: number) => String(n)

/** 소수를 정확히 더한다(BigDecimal 합계와 같게). */
function decimalSum(values: number[]): string {
  const parts = values.map((v) => {
    const [i, f = ''] = plain(v).split('.')
    return { i, f }
  })
  const scale = Math.max(0, ...parts.map((p) => p.f.length))
  let total = 0n
  for (const p of parts) {
    const neg = p.i.startsWith('-')
    const digits = BigInt((neg ? p.i.slice(1) : p.i) + p.f.padEnd(scale, '0'))
    total += neg ? -digits : digits
  }
  const neg = total < 0n
  let s = (neg ? -total : total).toString().padStart(scale + 1, '0')
  let out = scale ? `${s.slice(0, s.length - scale)}.${s.slice(s.length - scale)}` : s
  if (out.includes('.')) out = out.replace(/0+$/, '').replace(/\.$/, '')
  s = (neg ? '-' : '') + out
  return s
}

// ---------- 요청 본문 읽기(Jackson과 같게: 형식이 틀리면 400 '입력 형식이 올바르지 않아요.') ----------

const unreadable = () => new ApiError(400, '입력 형식이 올바르지 않아요.')

function bodyObject(req: Request, required = true): Record<string, unknown> | null {
  const b = req.body
  if (b === undefined || b === null) {
    if (required) throw unreadable()
    return null
  }
  if (typeof b !== 'object' || Array.isArray(b)) throw unreadable()
  return b as Record<string, unknown>
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  throw unreadable()
}

function num(v: unknown): number | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  throw unreadable()
}

function long(v: unknown): number | null {
  const n = num(v)
  if (n === null) return null
  if (!Number.isSafeInteger(Math.trunc(n))) throw unreadable()
  return Math.trunc(n)
}

function bool(v: unknown): boolean | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  if (typeof v === 'number') return v !== 0
  throw unreadable()
}

function enumOf<K extends string>(d: { has: (v: unknown) => v is K }, v: unknown): K | null {
  if (v === undefined || v === null) return null
  if (d.has(v)) return v
  throw unreadable()
}

function list<T>(v: unknown, item: (x: unknown) => T): T[] | null {
  if (v === undefined || v === null) return null
  if (!Array.isArray(v)) throw unreadable()
  return v.map(item)
}

function objectOrNull(v: unknown): Record<string, unknown> | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'object' || Array.isArray(v)) throw unreadable()
  return v as Record<string, unknown>
}

/** Set<Enum>: 같은 값은 한 번만(처음 나온 순서). */
const uniq = <T>(xs: T[] | null) => (xs == null ? null : [...new Set(xs)])

interface MaterialInput { part: MaterialPartCode | null; fiber: FiberCode | null; percent: number | null }
interface MeasurementInput { part: MeasurementPartCode | null; kind: MeasurementKindCode | null; valueCm: number | null; source: string | null }

interface GarmentInput {
  name: string | null
  brand: string | null
  productCode: string | null
  colorName: string | null
  colorHex: string | null
  sizeLabel: string | null
  origin: string | null
  subType: SubTypeCode | null
  wearFrequency: WearFrequencyCode | null
  seasons: (SeasonCode | null)[] | null
  collections: (string | null)[] | null
  materials: (MaterialInput | null)[] | null
  careLines: (string | null)[] | null
  measurements: (MeasurementInput | null)[] | null
  usableWhenPending: boolean | null
  imageIds: (number | null)[] | null
  coverImageId: number | null
  extractionId: number | null
  candidateId: number | null
  aiFields: (GarmentFieldCode | null)[] | null
  spaceId: number | null
  searchId: number | null
}

function readGarmentInput(req: Request): GarmentInput {
  const b = bodyObject(req)!
  const input: GarmentInput = {
    name: str(b.name),
    brand: str(b.brand),
    productCode: str(b.productCode),
    colorName: str(b.colorName),
    colorHex: str(b.colorHex),
    sizeLabel: str(b.sizeLabel),
    origin: str(b.origin),
    subType: enumOf(SubType, b.subType),
    wearFrequency: enumOf(WearFrequency, b.wearFrequency),
    seasons: uniq(list(b.seasons, (x) => enumOf(Season, x))),
    collections: uniq(list(b.collections, str)),
    materials: list(b.materials, (x) => {
      const o = objectOrNull(x)
      return o && { part: enumOf(MaterialPart, o.part), fiber: enumOf(Fiber, o.fiber), percent: num(o.percent) }
    }),
    careLines: list(b.careLines, str),
    measurements: list(b.measurements, (x) => {
      const o = objectOrNull(x)
      return o && { part: enumOf(MeasurementPart, o.part), kind: enumOf(MeasurementKind, o.kind), valueCm: num(o.valueCm), source: str(o.source) }
    }),
    usableWhenPending: bool(b.usableWhenPending),
    imageIds: list(b.imageIds, long),
    coverImageId: long(b.coverImageId),
    extractionId: long(b.extractionId),
    candidateId: long(b.candidateId),
    aiFields: uniq(list(b.aiFields, (x) => enumOf(GarmentField, x))),
    spaceId: long(b.spaceId),
    searchId: long(b.searchId),
  }
  validateGarmentInput(input)
  return input
}

const sizeMessage = (max: number) => `size must be between 0 and ${max}`
const over = (v: string | null, max: number) => v != null && v.length > max

/** GarmentInput의 Bean Validation. */
function validateGarmentInput(in_: GarmentInput) {
  const c = new Check()
  c.when(in_.name == null || javaTrim(in_.name).length === 0, '옷 이름을 입력해 주세요.')
  c.when(over(in_.name, 100), '옷 이름은 100자까지 쓸 수 있어요.')
  c.when(over(in_.brand, 100), sizeMessage(100))
  c.when(over(in_.productCode, 100), sizeMessage(100))
  c.when(over(in_.colorName, 50), sizeMessage(50))
  c.when(in_.colorHex != null && !/^#[0-9a-fA-F]{6}$/.test(in_.colorHex), '색상 코드는 #RRGGBB 형식이어야 해요.')
  c.when(over(in_.sizeLabel, 50), sizeMessage(50))
  c.when(over(in_.origin, 100), sizeMessage(100))
  c.when(in_.subType == null, '옷 종류를 골라 주세요.')
  for (const name of in_.collections ?? []) c.when(over(name, 50), '컬렉션 이름은 50자까지 쓸 수 있어요.')
  for (const m of in_.materials ?? []) {
    if (!m) continue
    c.when(m.part == null, '소재 부위를 골라 주세요.')
    c.when(m.fiber == null, '섬유를 골라 주세요.')
    c.when(m.percent == null, '혼용률을 입력해 주세요.')
    c.when(m.percent != null && m.percent < 0.1, '혼용률은 0보다 커야 해요.')
    c.when(m.percent != null && m.percent > 100, '혼용률은 100% 이하여야 해요.')
  }
  for (const line of in_.careLines ?? []) c.when(over(line, 200), '세탁·관리 지시는 한 줄에 200자까지 쓸 수 있어요.')
  for (const m of in_.measurements ?? []) {
    if (!m) continue
    c.when(m.part == null, '치수 부위를 골라 주세요.')
    c.when(m.kind == null, '치수 종류를 골라 주세요.')
    c.when(m.valueCm == null, '치수를 입력해 주세요.')
    c.when(m.valueCm != null && m.valueCm < 0.1, '치수는 0보다 커야 해요.')
    c.when(m.valueCm != null && m.valueCm > 999, '치수가 너무 커요.')
    c.when(over(m.source, 300), sizeMessage(300))
  }
  c.done()
}

/** null 원소는 Java에서 언박싱·NPE로 500이 된다. */
function nonNull<T>(v: T | null): T {
  if (v === null) throw new Error('null element in request')
  return v
}

// ---------- 택 판독·제품 검색 읽기 ----------

interface FieldValue { field: GarmentFieldCode; readValue: string | null; correctedValue: string | null }
interface LabelExtraction { id: number; userId: number; rawText: string | null; status: string; errorMessage: string | null; imageIds: number[]; values: FieldValue[] }

async function loadExtraction(row: any): Promise<LabelExtraction> {
  const [images, values] = await Promise.all([
    query('SELECT image_id FROM label_extraction_images WHERE extraction_id = ? ORDER BY image_id', [row.id]),
    query('SELECT field_code, read_value, corrected_value FROM label_extraction_values WHERE extraction_id = ?', [row.id]),
  ])
  return {
    id: row.id, userId: row.user_id, rawText: row.raw_text, status: row.status_code, errorMessage: row.error_message,
    imageIds: images.map((r) => r.image_id),
    values: values.map((r) => ({ field: r.field_code, readValue: r.read_value, correctedValue: r.corrected_value })),
  }
}

const EXTRACTION_COLS = 'id, user_id, raw_text, status_code, error_message'

async function ownedExtraction(id: number, userId: number) {
  const r = await one(`SELECT ${EXTRACTION_COLS} FROM label_extractions WHERE id = ? AND user_id = ?`, [id, userId])
  return r ? loadExtraction(r) : undefined
}

async function latestExtractionForGarment(garmentId: number) {
  const r = await one(`SELECT ${EXTRACTION_COLS} FROM label_extractions
    WHERE id = (SELECT MAX(l.extraction_id) FROM garment_label_extractions l WHERE l.garment_id = ?)`, [garmentId])
  return r ? loadExtraction(r) : undefined
}

export function extractionView(e: LabelExtraction) {
  return {
    id: e.id,
    rawText: e.rawText,
    status: e.status,
    errorMessage: e.errorMessage,
    values: [...e.values].sort((a, b) => GarmentField.ordinal(a.field) - GarmentField.ordinal(b.field)).map((v) => ({
      field: v.field, fieldLabel: GarmentField.label(v.field), readValue: v.readValue, correctedValue: v.correctedValue, unread: v.readValue == null,
    })),
    imageIds: [...e.imageIds].sort((a, b) => a - b),
  }
}

/** 택 판독값과 같은 모양의 글자로 옮긴 옷 정보(소재는 '겉감 면 100%, …', 세탁법은 ' / '로 이음). */
function fieldText(g: Garment, field: GarmentFieldCode): string | null {
  switch (field) {
    case 'NAME': return g.name
    case 'BRAND': return g.brand
    case 'PRODUCT_CODE': return g.productCode
    case 'COLOR': return g.colorName
    case 'SIZE_LABEL': return g.sizeLabel
    case 'ORIGIN': return g.origin
    case 'MATERIAL': return g.materials.length === 0 ? null : [...g.materials]
      .sort((a, b) => MaterialPart.ordinal(a.part) - MaterialPart.ordinal(b.part) || Fiber.ordinal(a.fiber) - Fiber.ordinal(b.fiber))
      .map((m) => `${MaterialPart.label(m.part)} ${Fiber.label(m.fiber)} ${plain(m.percent)}%`)
      .join(', ')
    case 'CARE': return g.careLines.length === 0 ? null : [...g.careLines].sort((a, b) => a.lineNo - b.lineNo).map((c) => c.instruction).join(' / ')
    default: return null
  }
}

/** Java String.split(",\\s*"): 끝의 빈 조각은 버린다. */
function javaSplit(s: string): string[] {
  const parts = s.split(/,[ \t\n\x0B\f\r]*/)
  while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
  return parts
}

function sameText(field: GarmentFieldCode, read: string | null, current: string): boolean {
  if (read == null) return false
  if (field === 'MATERIAL') {
    const a = new Set(javaSplit(read))
    const b = new Set(javaSplit(current))
    return a.size === b.size && [...a].every((x) => b.has(x))
  }
  return javaTrim(read) === javaTrim(current)
}

/**
 * 택에서 읽은 값과 지금 옷 정보가 다르면 사용자가 고친 값으로 남긴다(label_extraction_values.corrected_value).
 * 고친 항목은 'AI가 채운 항목'에서 뺀다(g.aiFields만 바꾸고 저장은 부른 쪽이 한다).
 */
async function recordCorrections(g: Garment, e: LabelExtraction) {
  for (const v of e.values) {
    const current = fieldText(g, v.field)
    const corrected = current == null || sameText(v.field, v.readValue, current) ? null : current
    if (corrected !== v.correctedValue) {
      await run('UPDATE label_extraction_values SET corrected_value = ? WHERE extraction_id = ? AND field_code = ?', [corrected, e.id, v.field])
      v.correctedValue = corrected
    }
    if (corrected != null) g.aiFields = g.aiFields.filter((f) => f !== v.field)
  }
}

// ---------- 이미지 ----------

/** 이미지 종류는 저장하지 않고 계산한다: 택 사진 → 정리본 → 제품 이미지 → 옷 사진. */
async function imageKinds(imageIds: number[]): Promise<Map<number, ImageKind>> {
  const kinds = new Map<number, ImageKind>()
  if (!imageIds.length) return kinds
  const p = inList(imageIds)
  const [labelRows, processedRows, metaRows] = await Promise.all([
    query('SELECT DISTINCT image_id FROM label_extraction_images WHERE image_id IN (?)', p),
    query('SELECT result_image_id FROM image_processings WHERE result_image_id IN (?)', p),
    query('SELECT id, source_url FROM images WHERE id IN (?)', p),
  ])
  const labels = new Set(labelRows.map((r) => r.image_id))
  const processed = new Set(processedRows.map((r) => r.result_image_id))
  const sources = new Map(metaRows.map((r) => [r.id, r.source_url]))
  for (const id of imageIds) {
    kinds.set(id, labels.has(id) ? 'LABEL' : processed.has(id) ? 'PROCESSED' : sources.get(id) != null ? 'PRODUCT_ORIGINAL' : 'GARMENT_ORIGINAL')
  }
  return kinds
}

async function linkImage(userId: number, garmentId: number, imageId: number) {
  if (!(await one('SELECT id FROM images WHERE id = ? AND user_id = ?', [imageId, userId]))) throw ApiError.notFound('사진')
  const existing = await one('SELECT garment_id FROM garment_images WHERE image_id = ?', [imageId])
  if (existing) {
    if (existing.garment_id !== garmentId) throw ApiError.badRequest('이미 다른 옷에 연결된 사진이에요.')
    return
  }
  await run('INSERT INTO garment_images (image_id, garment_id) VALUES (?, ?)', [imageId, garmentId])
}

async function setCover(garmentId: number, imageId: number) {
  await run(`INSERT INTO garment_cover_images (garment_id, image_id) VALUES (?, ?)
    ON DUPLICATE KEY UPDATE image_id = VALUES(image_id)`, [garmentId, imageId])
}

// ---------- 상세 ----------

/** 옷 상세(GarmentDetail). */
export async function detail(userId: number, garmentId: number) {
  const g = await owned(userId, garmentId)
  const ctx = await loadContext(userId)
  const status = ctx.status(g)
  const placement = ctx.placements.get(g.id)
  const awaitingConfirm = status === 'RETURNED_UNPLACED' && placement != null

  const imageIds: number[] = (await query('SELECT image_id FROM garment_images WHERE garment_id = ? ORDER BY image_id', [g.id])).map((r) => r.image_id)
  const kinds = await imageKinds(imageIds)
  const sources = new Map<number, string | null>()
  const processedFrom = new Map<number, number>()
  const processing = new Map<number, string>()
  if (imageIds.length) {
    const p = inList(imageIds)
    for (const m of await query('SELECT id, source_url FROM images WHERE id IN (?)', p)) sources.set(m.id, m.source_url)
    for (const r of await query('SELECT source_image_id, result_image_id FROM image_processings WHERE source_image_id IN (?)', p)) {
      processing.set(r.source_image_id, r.result_image_id == null ? 'FAILED' : 'DONE')
      if (r.result_image_id != null) processedFrom.set(r.result_image_id, r.source_image_id)
    }
  }
  const images = imageIds.map((id) => ({
    id, kind: kinds.get(id)!, url: imageUrl(id), sourceUrl: sources.get(id) ?? null,
    processedFromId: processedFrom.get(id) ?? null, processing: processing.get(id) ?? null,
  }))

  const latest = await latestExtractionForGarment(g.id)
  const extraction = latest ? extractionView(latest) : null
  const gp = await one('SELECT garment_id, candidate_id, confirmed_at FROM garment_products WHERE garment_id = ?', [g.id])
  const confirmedCandidate: number | null = gp ? gp.candidate_id : null
  let searchRow = latest
    ? await one(`SELECT id, status_code, searched_at FROM product_searches
        WHERE id = (SELECT MAX(l.search_id) FROM label_extraction_searches l WHERE l.extraction_id = ?)`, [latest.id])
    : undefined
  if (!searchRow) {
    searchRow = await one(`SELECT s.id, s.status_code, s.searched_at FROM product_searches s
      JOIN garment_product_searches g ON g.search_id = s.id WHERE g.garment_id = ?`, [g.id])
  }
  const search = searchRow ? {
    id: searchRow.id,
    status: searchRow.status_code,
    searchedAt: instant(searchRow.searched_at),
    candidates: (await query('SELECT id, name, brand, color_name, image_url, source_url, match_reason FROM product_candidates WHERE search_id = ? ORDER BY id', [searchRow.id]))
      .map((c) => ({
        id: c.id, name: c.name, brand: c.brand, colorName: c.color_name, imageUrl: c.image_url, sourceUrl: c.source_url,
        matchReason: c.match_reason, confirmed: c.id === confirmedCandidate,
      })),
  } : null
  let product = null
  if (gp) {
    const c = await one('SELECT id, search_id, name, brand, color_name, image_url, source_url, match_reason FROM product_candidates WHERE id = ?', [gp.candidate_id])
    if (c) {
      const s = await one('SELECT searched_at FROM product_searches WHERE id = ?', [c.search_id])
      product = {
        candidateId: c.id, name: c.name, brand: c.brand, colorName: c.color_name, imageUrl: c.image_url, sourceUrl: c.source_url,
        matchReason: c.match_reason, searchedAt: s ? instant(s.searched_at) : null, confirmedAt: instant(gp.confirmed_at),
      }
    }
  }
  const careHistory = (await query(`SELECT id, garment_id, care_type_code, place_code, shop_name, description, dropped_on, due_on, completed_at, created_at
    FROM care_events WHERE garment_id = ? ORDER BY id DESC`, [g.id])).map((r) => careView(careFromRow(r)))

  return {
    summary: summary(g, ctx),
    productCode: g.productCode,
    sizeLabel: g.sizeLabel,
    origin: g.origin,
    homeStatus: g.homeStatus,
    usableWhenPending: g.usableWhenPending,
    aiFields: [...g.aiFields].sort(),
    placedAt: placement ? instant(placement.placedAt) : null,
    materials: [...g.materials]
      .sort((a, b) => MaterialPart.ordinal(a.part) - MaterialPart.ordinal(b.part) || b.percent - a.percent)
      .map((m) => ({ part: m.part, partLabel: MaterialPart.label(m.part), fiber: m.fiber, fiberLabel: Fiber.label(m.fiber), percent: m.percent })),
    careLines: [...g.careLines].sort((a, b) => a.lineNo - b.lineNo).map((c) => c.instruction),
    measurements: [...g.measurements]
      .sort((a, b) => MeasurementPart.ordinal(a.part) - MeasurementPart.ordinal(b.part) || MeasurementKind.ordinal(a.kind) - MeasurementKind.ordinal(b.kind))
      .map((m) => ({
        part: m.part, partLabel: MeasurementPart.label(m.part), kind: m.kind, kindLabel: MeasurementKind.label(m.kind),
        valueCm: m.valueCm, source: m.source, confirmed: m.confirmed,
      })),
    coverImageId: ctx.covers.get(g.id) ?? null,
    images,
    extraction,
    search,
    product,
    careHistory,
    suggestedSpaceId: awaitingConfirm ? placement!.spaceId : null,
    suggestedLocationPath: awaitingConfirm ? ctx.paths.get(placement!.spaceId) ?? null : null,
  }
}

// ---------- 등록·수정 ----------

/** 같은 부위·섬유가 두 번 나오지 않고, 부위별 혼용률 합계가 100%여야 한다. */
function validateMaterials(materials: MaterialInput[]) {
  const sums = new Map<MaterialPartCode, number[]>()
  const seen = new Set<string>()
  for (const m of materials) {
    const part = m.part!
    const fiber = m.fiber!
    const key = `${part}/${fiber}`
    if (seen.has(key)) throw ApiError.badRequest(`${MaterialPart.label(part)}에 ${Fiber.label(fiber)}이(가) 두 번 들어 있어요.`)
    seen.add(key)
    const list = sums.get(part)
    if (list) list.push(m.percent!)
    else sums.set(part, [m.percent!])
  }
  for (const [part, values] of sums) {
    const total = decimalSum(values)
    if (total !== '100') {
      throw ApiError.badRequest(`${MaterialPart.label(part)} 혼용률 합계가 ${total}%예요. 100%가 되게 고쳐 주세요.`)
    }
  }
}

async function apply(userId: number, g: Garment, in_: GarmentInput) {
  g.name = javaTrim(in_.name!)
  g.brand = blankToNull(in_.brand)
  g.productCode = blankToNull(in_.productCode)
  g.colorName = blankToNull(in_.colorName)
  g.colorHex = blankToNull(in_.colorHex)
  g.sizeLabel = blankToNull(in_.sizeLabel)
  g.origin = blankToNull(in_.origin)
  g.subType = in_.subType!
  if (in_.wearFrequency != null) g.wearFrequency = in_.wearFrequency
  if (in_.usableWhenPending != null) g.usableWhenPending = in_.usableWhenPending
  g.seasons = in_.seasons ? in_.seasons.map(nonNull) : []
  g.collectionIds = []
  for (const raw of in_.collections ?? []) {
    const name = raw == null ? '' : javaTrim(raw)
    if (!name) continue
    let c = await one('SELECT id FROM collections WHERE user_id = ? AND name = ?', [userId, name])
    if (!c) {
      const r = await run('INSERT INTO collections (user_id, name) VALUES (?, ?)', [userId, name])
      c = { id: r.insertId } as any
    }
    if (!g.collectionIds.includes(c!.id)) g.collectionIds.push(c!.id)
  }
  g.materials = []
  if (in_.materials) {
    const materials = in_.materials.map(nonNull)
    validateMaterials(materials)
    for (const m of materials) {
      if (!g.materials.some((x) => x.part === m.part && x.fiber === m.fiber && x.percent === m.percent)) {
        g.materials.push({ part: m.part!, fiber: m.fiber!, percent: m.percent! })
      }
    }
  }
  g.careLines = []
  let line = 1
  for (const raw of in_.careLines ?? []) {
    if (raw != null && !javaIsBlank(raw)) g.careLines.push({ lineNo: line++, instruction: javaTrim(raw) })
  }
  g.measurements = []
  if (in_.measurements) {
    const seen = new Set<string>()
    for (const m of in_.measurements.map(nonNull)) {
      const key = `${m.part}/${m.kind}`
      if (seen.has(key)) throw ApiError.badRequest('같은 부위·종류의 치수가 두 번 들어 있어요.')
      seen.add(key)
      g.measurements.push({ part: m.part!, kind: m.kind!, valueCm: m.valueCm!, source: blankToNull(m.source), confirmed: false })
    }
  }
}

function changedFields(g: Garment, in_: GarmentInput): Set<GarmentFieldCode> {
  const changed = new Set<GarmentFieldCode>()
  const compare = (field: GarmentFieldCode, before: unknown, after: unknown) => {
    if (before !== after) changed.add(field)
  }
  compare('NAME', g.name, in_.name == null ? null : javaTrim(in_.name))
  compare('BRAND', g.brand, blankToNull(in_.brand))
  compare('PRODUCT_CODE', g.productCode, blankToNull(in_.productCode))
  compare('COLOR', g.colorName, blankToNull(in_.colorName))
  compare('SIZE_LABEL', g.sizeLabel, blankToNull(in_.sizeLabel))
  compare('ORIGIN', g.origin, blankToNull(in_.origin))
  compare('SUB_TYPE', g.subType, in_.subType)
  const before = new Set(g.seasons)
  const after = new Set(in_.seasons ?? [])
  if (before.size !== after.size || [...before].some((s) => !after.has(s))) changed.add('SEASONS')
  const newMaterials: MaterialInput[] = []
  for (const m of in_.materials ?? []) {
    const x = nonNull(m)
    if (!newMaterials.some((y) => y.part === x.part && y.fiber === x.fiber && y.percent === x.percent)) newMaterials.push(x)
  }
  const sameMaterials = g.materials.length === newMaterials.length
    && g.materials.every((x) => newMaterials.some((y) => x.part === y.part && x.fiber === y.fiber && x.percent === y.percent))
  if (!sameMaterials) changed.add('MATERIAL')
  const oldLines = [...g.careLines].sort((a, b) => a.lineNo - b.lineNo).map((c) => c.instruction)
  const newLines = (in_.careLines ?? []).filter((l): l is string => l != null && !javaIsBlank(l)).map(javaTrim)
  if (oldLines.length !== newLines.length || oldLines.some((l, i) => l !== newLines[i])) changed.add('CARE')
  return changed
}

async function create(userId: number, in_: GarmentInput) {
  const g = newGarment(userId)
  await apply(userId, g, in_)
  if (in_.aiFields) for (const f of in_.aiFields.map(nonNull)) if (!g.aiFields.includes(f)) g.aiFields.push(f)
  await saveGarment(g)

  const linked = new Set<number>()
  if (in_.imageIds) {
    for (const raw of in_.imageIds) {
      const imageId = nonNull(raw)
      await linkImage(userId, g.id, imageId)
      linked.add(imageId)
    }
  }
  if (in_.extractionId != null) {
    const extraction = await ownedExtraction(in_.extractionId, userId)
    if (!extraction) throw ApiError.notFound('택 분석 결과')
    if (await one('SELECT extraction_id FROM garment_label_extractions WHERE extraction_id = ?', [extraction.id])) {
      throw ApiError.conflict('이미 다른 옷 등록에 쓴 택 분석이에요.')
    }
    await run('INSERT INTO garment_label_extractions (extraction_id, garment_id) VALUES (?, ?)', [extraction.id, g.id])
    for (const imageId of extraction.imageIds) {
      if (!linked.has(imageId)) {
        await linkImage(userId, g.id, imageId)
        linked.add(imageId)
      }
    }
    const before = [...g.aiFields]
    await recordCorrections(g, extraction)
    for (const f of before) {
      if (!g.aiFields.includes(f)) await run('DELETE FROM garment_ai_fields WHERE garment_id = ? AND field_code = ?', [g.id, f])
    }
  }
  if (in_.searchId != null) {
    if (!(await one('SELECT id FROM product_searches WHERE id = ? AND user_id = ?', [in_.searchId, userId]))) throw ApiError.notFound('제품 검색')
    await run(`INSERT INTO garment_product_searches (garment_id, search_id) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE search_id = VALUES(search_id)`, [g.id, in_.searchId])
  }
  let productImage: number | null = null
  if (in_.candidateId != null) {
    const candidate = await one(`SELECT id, search_id, image_url FROM product_candidates
      WHERE id = ? AND search_id IN (SELECT s.id FROM product_searches s WHERE s.user_id = ?)`, [in_.candidateId, userId])
    if (!candidate) throw ApiError.notFound('제품 후보')
    if (in_.extractionId != null) {
      const les = await one('SELECT extraction_id FROM label_extraction_searches WHERE search_id = ?', [candidate.search_id])
      if (!les || les.extraction_id !== in_.extractionId) throw ApiError.badRequest('이 택 분석에서 찾은 후보가 아니에요.')
    }
    await run('INSERT INTO garment_products (garment_id, candidate_id, confirmed_at) VALUES (?, ?, ?)', [g.id, candidate.id, new Date()])
    // 직접 찍은 사진이 없으면 고른 제품의 이미지를 가져와 대표 이미지로 쓴다(못 가져오면 그림으로 표시).
    if ((!in_.imageIds || in_.imageIds.length === 0) && candidate.image_url != null) {
      const assetId = await fetchRemoteImage(userId, candidate.image_url)
      if (assetId != null) {
        await run('INSERT INTO garment_images (image_id, garment_id) VALUES (?, ?)', [assetId, g.id])
        linked.add(assetId)
        productImage = assetId
      }
    }
  }
  const cover = in_.coverImageId != null ? in_.coverImageId
    : in_.imageIds && in_.imageIds.length ? in_.imageIds[0] : productImage
  if (cover != null) {
    if (!linked.has(cover)) throw ApiError.badRequest('대표 사진은 이 옷에 올린 사진 중에서 골라 주세요.')
    await setCover(g.id, cover)
  }
  if (in_.spaceId != null) {
    await requireLeafSpace(userId, in_.spaceId)
    await place(g.id, in_.spaceId)
  }
  return detail(userId, g.id)
}

async function update(userId: number, garmentId: number, in_: GarmentInput) {
  const g = await owned(userId, garmentId)
  const changed = changedFields(g, in_)
  await apply(userId, g, in_)
  if (in_.coverImageId != null) {
    const image = await one('SELECT image_id, garment_id FROM garment_images WHERE image_id = ?', [in_.coverImageId])
    if (!image || image.garment_id !== g.id) throw ApiError.badRequest('대표 사진은 이 옷에 올린 사진 중에서 골라 주세요.')
    await setCover(g.id, image.image_id)
  }
  g.aiFields = g.aiFields.filter((f) => !changed.has(f))
  const latest = await latestExtractionForGarment(g.id)
  if (latest) await recordCorrections(g, latest)
  g.updatedAt = new Date()
  await saveGarment(g)
  return detail(userId, g.id)
}

/** 사용자가 정하는 집 안 상태만 바꾼다. 세탁 중·수선 중·회수는 관리함 기록에서 계산된다. */
async function updateStatus(userId: number, garmentId: number, status: GarmentStatusCode, usableWhenPending: boolean | null) {
  const g = await owned(userId, garmentId)
  if (!GarmentStatus.isHome(status)) {
    throw ApiError.badRequest(GarmentStatus.isAway(status)
      ? "세탁 중·수선 중은 '세탁·수선 맡기기'로 기록해 주세요."
      : '회수 완료는 관리함에서 기록해 주세요.')
  }
  if (await openCareOf(g.id)) throw ApiError.conflict('진행 중인 세탁·수선 기록이 있어요. 관리함에서 회수 완료를 먼저 눌러 주세요.')
  const usable = usableWhenPending ?? g.usableWhenPending
  await run('UPDATE garments SET status_code = ?, usable_when_pending = ?, updated_at = ? WHERE id = ?', [status, usable ? 1 : 0, new Date(), g.id])
  return detail(userId, g.id)
}

/** 실제로 옷을 넣은 뒤 위치를 확정한다('재배치 확인'). */
async function confirmPlacement(userId: number, garmentId: number, spaceId: number | null) {
  const g = await owned(userId, garmentId)
  if (await openCareOf(g.id)) throw ApiError.conflict('세탁·수선 중인 옷은 회수 완료 후에 위치를 확정할 수 있어요.')
  const current = await one('SELECT space_id FROM garment_placements WHERE garment_id = ?', [g.id])
  const target: number | null = spaceId != null ? spaceId : current ? current.space_id : null
  if (target == null) throw ApiError.badRequest('넣을 공간을 골라 주세요.')
  await requireLeafSpace(userId, target)
  await place(g.id, target)
  // 위치를 확인해 넣었으니 집 안 상태도 보관 중이다(R08 '재배치 확인' → '보관 중').
  await run('UPDATE garments SET status_code = ?, updated_at = ? WHERE id = ?', ['STORED', new Date(), g.id])
  return detail(userId, g.id)
}

/**
 * 대표 이미지 정리 결과를 기록한다. 결과 파일이 없으면 실패로 남겨 원본을 대표로 쓴다.
 * 다시 처리하면 이전 정리본을 지우고 새 결과로 바꾼다. 원본은 지우지 않는다.
 */
async function recordProcessing(userId: number, garmentId: number, sourceImageId: number, file: Express.Multer.File | undefined) {
  const g = await owned(userId, garmentId)
  const gi = await one('SELECT garment_id FROM garment_images WHERE image_id = ?', [sourceImageId])
  if (!gi || gi.garment_id !== g.id) throw ApiError.notFound('사진')
  const kind = (await imageKinds([sourceImageId])).get(sourceImageId)
  if (kind !== 'GARMENT_ORIGINAL' && kind !== 'PRODUCT_ORIGINAL') throw ApiError.badRequest('옷 사진이나 제품 이미지만 정리할 수 있어요.')
  const existing = await one('SELECT result_image_id FROM image_processings WHERE source_image_id = ?', [sourceImageId])
  const oldResult: number | null = existing ? existing.result_image_id : null
  let newResult: number | null = null
  if (file && file.size > 0) {
    newResult = await storeImage(userId, file.buffer, file.mimetype, null)
    await run('INSERT INTO garment_images (image_id, garment_id) VALUES (?, ?)', [newResult, g.id])
  }
  await run(`INSERT INTO image_processings (source_image_id, result_image_id, processed_at) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE result_image_id = VALUES(result_image_id), processed_at = VALUES(processed_at)`, [sourceImageId, newResult, new Date()])

  // 원본이나 이전 정리본이 대표였으면(또는 대표가 없으면) 새 정리본, 실패했으면 원본을 대표로 쓴다.
  const coverTarget = newResult ?? sourceImageId
  const cover = await one('SELECT image_id FROM garment_cover_images WHERE garment_id = ?', [g.id])
  if (!cover) {
    await run('INSERT INTO garment_cover_images (garment_id, image_id) VALUES (?, ?)', [g.id, coverTarget])
  } else if (cover.image_id === sourceImageId || (oldResult != null && cover.image_id === oldResult)) {
    await run('UPDATE garment_cover_images SET image_id = ? WHERE garment_id = ?', [coverTarget, g.id])
  }
  if (oldResult != null) {
    // 처리 기록·대표 이미지가 새 값으로 바뀐 뒤 이전 정리본을 지운다.
    await run('DELETE FROM garment_images WHERE image_id = ?', [oldResult])
    await run('DELETE FROM images WHERE id = ?', [oldResult])
  }
  await touch(g.id)
  return detail(userId, g.id)
}

function matches(s: GarmentSummary, q: string): boolean {
  return [s.name, s.brand, s.colorName, s.categoryLabel, s.subTypeLabel, s.locationPath, s.locationKindLabel]
    .some((v) => v != null && v.toLowerCase().includes(q))
}

// ---------- 라우터 ----------

export const garmentsRouter = Router()

/** 내 옷장 목록. q로 이름·브랜드·색상·종류·위치 경로를 검색한다. */
garmentsRouter.get('/garments', handle(async (req) => {
  const userId = currentUser(req)
  const raw = req.query.q
  const query_ = raw == null ? null : Array.isArray(raw) ? raw.map(String).join(',') : String(raw)
  const q = query_ == null ? '' : javaTrim(query_).toLowerCase()
  const [ctx, garments] = await Promise.all([loadContext(userId), loadGarments(userId)])
  return garments.map((g) => summary(g, ctx)).filter((s) => q === '' || matches(s, q))
}))

garmentsRouter.get('/garments/:id', handle(async (req) => detail(currentUser(req), idParam(req))))

garmentsRouter.post('/garments', handle(async (req) => {
  const userId = currentUser(req)
  const input = readGarmentInput(req)
  return tx(() => create(userId, input))
}, 201))

garmentsRouter.put('/garments/:id', handle(async (req) => {
  const userId = currentUser(req)
  const id = idParam(req)
  const input = readGarmentInput(req)
  return tx(() => update(userId, id, input))
}))

garmentsRouter.patch('/garments/:id/status', handle(async (req) => {
  const userId = currentUser(req)
  const id = idParam(req)
  const b = bodyObject(req)!
  const status = enumOf(GarmentStatus, b.status)
  const usableWhenPending = bool(b.usableWhenPending)
  new Check().when(status == null, '상태를 골라 주세요.').done()
  return tx(() => updateStatus(userId, id, status!, usableWhenPending))
}))

garmentsRouter.post('/garments/:id/confirm-placement', handle(async (req) => {
  const userId = currentUser(req)
  const id = idParam(req)
  const b = bodyObject(req, false)
  const spaceId = b ? long(b.spaceId) : null
  return tx(() => confirmPlacement(userId, id, spaceId))
}))

/** 브라우저에서 정리한 대표 이미지를 기록한다. file이 없으면 처리 실패로 기록하고 원본을 대표로 쓴다. */
garmentsRouter.post('/garments/:id/images/:imageId/processing', (req, res, next) => {
  // consumes = multipart/form-data
  if (!req.is('multipart/form-data')) {
    res.status(415).json({ error: 'Unsupported Media Type' })
    return
  }
  next()
}, upload.any(), handle(async (req) => {
  const userId = currentUser(req)
  const id = idParam(req)
  const imageId = idParam(req, 'imageId')
  const files = Array.isArray(req.files) ? req.files : []
  const file = files.find((f) => f.fieldname === 'file')
  return tx(() => recordProcessing(userId, id, imageId, file))
}))

garmentsRouter.delete('/garments/:id', handle(async (req) => {
  const userId = currentUser(req)
  const id = idParam(req)
  await tx(async () => {
    const g = await owned(userId, id)
    await run('DELETE FROM garments WHERE id = ?', [g.id])
  })
}, 204))
