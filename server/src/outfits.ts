import { Router, type Request } from 'express'
import { inList, one, query, run, tx } from './db.js'
import { currentSeason, instant } from './dates.js'
import { Season, WearFrequency, type Season as SeasonCode } from './domain.js'
import { ApiError, Check, handle, idParam, isBlank, tooLong } from './http.js'
import { currentUser } from './session.js'
import { loadContext, loadGarments, summary, type ClosetContext, type Garment, type GarmentSummary } from './core.js'

/**
 * 코디(저장한 착장)와 규칙 기반 추천.
 * 코디에는 지금 바로 입을 수 있는 옷(집 안에 있고 사용 가능)만 넣는다. 박스·본가·세탁소·미배치 옷은 꺼낸 뒤에 고른다.
 * 저장한 뒤 옷이 박스나 세탁소로 옮겨지면 목록에서 '지금 입을 수 있는지'를 다시 계산해 알려 준다.
 */
export const outfitsRouter = Router()

export type Slot = 'OUTER' | 'TOP' | 'BOTTOM' | 'DRESS'
const SLOTS: Slot[] = ['OUTER', 'TOP', 'BOTTOM', 'DRESS']
const SLOT_LABEL: Record<Slot, string> = { OUTER: '아우터', TOP: '상의', BOTTOM: '하의', DRESS: '원피스' }
const isSlot = (v: unknown): v is Slot => typeof v === 'string' && (SLOTS as string[]).includes(v)
const COLD: SeasonCode[] = ['AUTUMN', 'WINTER']

const malformed = () => new ApiError(400, '입력 형식이 올바르지 않아요.')

/** 지금 바로 꺼내 입을 수 있는지: 집 안 자리에 있고 사용 가능한 상태. */
export function wearableNow(s: GarmentSummary): boolean {
  return s.locationKind === 'HOME' && s.usable
}

/** 지금 입을 수 없는 이유(코디에 넣으려 할 때의 안내). */
function notWearableMessage(s: GarmentSummary): string {
  const who = `'${s.name}'은(는)`
  switch (s.locationKind) {
    case 'BOX':
    case 'OFFSITE':
      return `${who} 지금 ${s.locationKindLabel}${s.locationPath ? ` · ${s.locationPath}` : ''}에 있어 코디에 넣을 수 없어요.`
    case 'CARE':
      return `${who} 지금 ${s.statusLabel}이라 코디에 넣을 수 없어요. 회수한 뒤에 골라 주세요.`
    case 'UNPLACED':
      return `${who} 아직 자리가 확인되지 않아 코디에 넣을 수 없어요. 옷장 지도에서 자리를 정해 주세요.`
    default:
      return `${who} 지금 ${s.statusLabel} 상태라 코디에 넣을 수 없어요.`
  }
}

interface LookRow { id: number; name: string; created_at: Date }

function lookView(look: LookRow, rows: { slot_code: Slot; garment_id: number }[], byId: Map<number, Garment>, ctx: ClosetContext) {
  const items = rows
    .filter((r) => byId.has(r.garment_id))
    .sort((a, b) => SLOTS.indexOf(a.slot_code) - SLOTS.indexOf(b.slot_code))
    .map((r) => ({ slot: r.slot_code, garment: summary(byId.get(r.garment_id)!, ctx) }))
  const away = items.filter((i) => !wearableNow(i.garment))
  return {
    id: look.id,
    name: look.name,
    createdAt: instant(look.created_at),
    items,
    wearableNow: items.length > 0 && away.length === 0,
    awayItems: away.map((i) => i.garment.name),
  }
}

async function looksOf(userId: number, lookId?: number) {
  const looks = await query<LookRow>(
    `SELECT id, name, created_at FROM outfit_looks WHERE user_id = ?${lookId == null ? '' : ' AND id = ?'} ORDER BY created_at DESC, id DESC`,
    lookId == null ? [userId] : [userId, lookId])
  const rows = await query<{ look_id: number; slot_code: Slot; garment_id: number }>(
    'SELECT look_id, slot_code, garment_id FROM outfit_look_garments WHERE look_id IN (?)', inList(looks.map((l) => l.id)))
  const [ctx, garments] = await Promise.all([loadContext(userId), loadGarments(userId)])
  const byId = new Map(garments.map((g) => [g.id, g]))
  // 옷을 모두 지운 코디(옷 FK가 CASCADE로 빠져 빈 껍데기만 남은 것)는 보여 줄 것이 없으니 목록에서 뺀다.
  return looks.map((l) => lookView(l, rows.filter((r) => r.look_id === l.id), byId, ctx)).filter((l) => l.items.length > 0)
}

interface LookInput { name: string; items: { slot: Slot; garmentId: number }[] }

function readInput(req: Request): LookInput {
  const b = req.body
  if (b == null || typeof b !== 'object' || Array.isArray(b)) throw malformed()
  const name = b.name
  if (name != null && typeof name !== 'string') throw malformed()
  const rawItems = b.items ?? []
  if (!Array.isArray(rawItems)) throw malformed()
  const items = rawItems.map((it: unknown) => {
    if (it == null || typeof it !== 'object') throw malformed()
    const { slot, garmentId } = it as Record<string, unknown>
    const id = Number(garmentId)
    if (!isSlot(slot)) throw ApiError.badRequest('자리는 아우터·상의·하의·원피스 중에서 골라 주세요.')
    if (garmentId == null || !Number.isSafeInteger(id)) throw malformed()
    return { slot, garmentId: id }
  })
  const slots = items.map((i) => i.slot)
  new Check()
    .when(isBlank(name), '코디 이름을 입력해 주세요.')
    .when(tooLong(name?.trim(), 50), '코디 이름은 50자까지 쓸 수 있어요.')
    .when(items.length === 0, '옷을 한 벌 이상 골라 주세요.')
    .when(new Set(slots).size !== slots.length, '한 자리에는 옷을 한 벌만 고를 수 있어요.')
    .when(slots.includes('DRESS') && (slots.includes('TOP') || slots.includes('BOTTOM')), '원피스는 상의·하의와 함께 고를 수 없어요.')
    .done()
  return { name: name.trim(), items }
}

async function create(userId: number, input: LookInput) {
  const [ctx, garments] = await Promise.all([loadContext(userId), loadGarments(userId)])
  const byId = new Map(garments.map((g) => [g.id, g]))
  for (const it of input.items) {
    const g = byId.get(it.garmentId)
    if (!g) throw ApiError.notFound('옷')
    const s = summary(g, ctx)
    if (s.category !== it.slot) {
      throw ApiError.badRequest(`'${s.name}'은(는) ${s.categoryLabel}라 ${SLOT_LABEL[it.slot]} 자리에 넣을 수 없어요.`)
    }
    if (!wearableNow(s)) throw ApiError.conflict(notWearableMessage(s))
  }
  const r = await run('INSERT INTO outfit_looks (user_id, name, created_at) VALUES (?, ?, ?)', [userId, input.name, new Date()])
  for (const it of input.items) {
    await run('INSERT INTO outfit_look_garments (look_id, slot_code, garment_id) VALUES (?, ?, ?)', [r.insertId, it.slot, it.garmentId])
  }
  return (await looksOf(userId, r.insertId))[0]
}

const FREQ = (g: GarmentSummary) => WearFrequency.ordinal(g.wearFrequency)

/** 계절이 맞는 옷을 먼저, 그다음 자주 입는 옷, 같으면 먼저 등록한 옷. 같은 옷장이면 늘 같은 결과다. */
function pick(pool: GarmentSummary[], season: SeasonCode): GarmentSummary | undefined {
  const fits = (g: GarmentSummary) => (g.seasons.length === 0 || g.seasons.includes(season) ? 0 : 1)
  return [...pool].sort((a, b) => fits(a) - fits(b) || FREQ(a) - FREQ(b) || a.id - b.id)[0]
}

export async function suggest(userId: number, season: SeasonCode) {
  const [ctx, garments] = await Promise.all([loadContext(userId), loadGarments(userId)])
  const ready = garments.map((g) => summary(g, ctx)).filter(wearableNow)
  const of = (c: Slot) => ready.filter((g) => g.category === c)
  const items: { slot: Slot; garment: GarmentSummary }[] = []
  const cold = COLD.includes(season)
  if (cold) {
    const outer = pick(of('OUTER'), season)
    if (outer) items.push({ slot: 'OUTER', garment: outer })
  }
  const top = pick(of('TOP'), season)
  const bottom = pick(of('BOTTOM'), season)
  const dress = pick(of('DRESS'), season)
  if (top && bottom) {
    items.push({ slot: 'TOP', garment: top }, { slot: 'BOTTOM', garment: bottom })
  } else if (dress) {
    items.push({ slot: 'DRESS', garment: dress })
  } else {
    if (top) items.push({ slot: 'TOP', garment: top })
    if (bottom) items.push({ slot: 'BOTTOM', garment: bottom })
  }
  items.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot))
  const label = Season.label(season)
  let reason: string
  if (items.length === 0) reason = '지금 집 안에서 바로 입을 수 있는 옷이 없어요.'
  else if (!items.some((i) => i.slot === 'DRESS') && !(top && bottom)) reason = `집 안에 있는 옷으로는 한 벌을 다 채우지 못했어요. ${label} 옷을 꺼내 두면 더 잘 골라 드릴게요.`
  else reason = `${label}에 맞는 옷 중 집 안에 있는 옷으로 골랐어요${cold && items.some((i) => i.slot === 'OUTER') ? '. 쌀쌀해서 아우터도 함께 골랐어요' : ''}.`
  return { season, seasonLabel: label, items, reason }
}

// ---------- 라우터 ----------

outfitsRouter.get('/outfits', handle(async (req) => looksOf(currentUser(req))))

outfitsRouter.get('/outfits/suggest', handle(async (req) => {
  const raw = req.query.season
  if (raw != null && !Season.has(raw)) throw ApiError.badRequest('계절은 봄·여름·가을·겨울 중에서 골라 주세요.')
  return suggest(currentUser(req), (raw as SeasonCode | undefined) ?? currentSeason())
}))

outfitsRouter.post('/outfits', handle(async (req) => {
  const userId = currentUser(req)
  const input = readInput(req)
  return tx(() => create(userId, input))
}, 201))

outfitsRouter.delete('/outfits/:id', handle(async (req) => {
  const userId = currentUser(req)
  const id = idParam(req)
  await tx(async () => {
    const look = await one('SELECT id FROM outfit_looks WHERE id = ? AND user_id = ?', [id, userId])
    if (!look) throw ApiError.notFound('코디')
    await run('DELETE FROM outfit_looks WHERE id = ?', [id])
  })
}, 204))

