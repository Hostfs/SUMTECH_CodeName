import { Router } from 'express'
import { inList, one, query, run, tx } from './db.js'
import { currentSeason } from './dates.js'
import { GarmentStatus, Season, SpaceType, SubType, WearFrequency, type SpaceType as SpaceTypeCode } from './domain.js'
import { ApiError, Check, handle, idParam } from './http.js'
import { currentUser } from './session.js'
import {
  loadContext, loadGarments, owned, parentMap, place, requireLeafSpace, spacesOf, summary,
  type ClosetContext, type Garment, type StorageSpace,
} from './core.js'

/**
 * 규칙 기반 배치 추천(Spring의 PlacementController·PlacementService). 비시즌 옷은 장기보관, 형태 유지가 필요한 옷은 걸기,
 * 나머지는 접기 공간을 우선하고 같은 유형 안에서는 남은 자리가 많은 공간을 고른다. 추천은 '배치 완료' 전까지 현재 위치를 바꾸지 않는다.
 */
export const placementsRouter = Router()

const malformed = () => new ApiError(400, '입력 형식이 올바르지 않아요.')

function long(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && /^\s*-?\d+\s*$/.test(v)) return Number(v)
  throw malformed()
}

interface Proposal { id: number; garmentId: number; spaceId: number; reason: string | null }

const fromRow = (r: any): Proposal => ({ id: r.id, garmentId: r.garment_id, spaceId: r.space_id, reason: r.reason })

async function proposalsOf(userId: number): Promise<Proposal[]> {
  return (await query(`SELECT p.id, p.garment_id, p.space_id, p.reason FROM placement_proposals p
    JOIN garments g ON g.id = p.garment_id WHERE g.user_id = ? ORDER BY p.id`, [userId])).map(fromRow)
}

async function deleteByGarmentIds(garmentIds: readonly number[]) {
  await run('DELETE FROM placement_proposals WHERE garment_id IN (?)', inList(garmentIds))
}

function confirmedLoad(all: Garment[], ctx: ClosetContext): Map<number, number> {
  const load = new Map<number, number>()
  for (const g of all) {
    if (ctx.locationConfirmed(g)) {
      const id = ctx.placements.get(g.id)!.spaceId
      load.set(id, (load.get(id) ?? 0) + 1)
    }
  }
  return load
}

/** 미확정 추천 목록(추천 ID 순). */
export async function pending(userId: number) {
  const [ctx, spaces, all, open] = await Promise.all([loadContext(userId), spacesOf(userId), loadGarments(userId), proposalsOf(userId)])
  const byId = new Map(spaces.map((s) => [s.id, s]))
  const garmentById = new Map(all.map((g) => [g.id, g]))
  const load = confirmedLoad(all, ctx)
  for (const p of open) load.set(p.spaceId, (load.get(p.spaceId) ?? 0) + 1)
  return open.map((p) => {
    const s = byId.get(p.spaceId)!
    const projected = load.get(s.id) ?? 0
    const overBy = s.capacity == null ? 0 : Math.max(0, projected - s.capacity)
    return {
      id: p.id,
      garment: summary(garmentById.get(p.garmentId)!, ctx),
      spaceId: s.id,
      spacePath: ctx.paths.get(s.id) ?? null,
      reason: p.reason,
      capacity: s.capacity,
      projectedCount: projected,
      overBy,
    }
  })
}

/**
 * 옷은 가장 안쪽 공간에 넣는다. '옷장 A'가 아니라 '옷장 A → 왼쪽 행거'를 추천한다.
 * 집 밖(본가 등)은 옮길 때 사용자가 직접 고르는 곳이라 추천하지 않는다.
 */
async function leafSpaces(userId: number): Promise<StorageSpace[]> {
  const hasChildren = new Set((await parentMap(userId)).values())
  return (await spacesOf(userId)).filter((s) => !hasChildren.has(s.id) && s.spaceType !== 'OFFSITE')
}

/** 장기보관을 우선하는 옷은 박스에도 넣을 수 있다. */
function fits(actual: SpaceTypeCode, preferred: SpaceTypeCode) {
  return actual === preferred || (preferred === 'LONG_TERM' && actual === 'BOX')
}

function preferredType(g: Garment, current: Season): SpaceTypeCode {
  if (g.seasons.length && !g.seasons.includes(current)) return 'LONG_TERM'
  const category = SubType.category(g.subType)
  const keepShape = category === 'OUTER' || category === 'DRESS' || g.subType === 'SHIRT'
  return keepShape ? 'HANG' : 'FOLD'
}

/** Java의 Integer.MAX_VALUE / 2. 수용 개수가 없는 공간은 늘 이만큼 남는다. */
const UNLIMITED = Math.trunc(2147483647 / 2)

function remaining(s: StorageSpace, load: Map<number, number>) {
  return s.capacity == null ? UNLIMITED : s.capacity - (load.get(s.id) ?? 0)
}

/** 남은 자리가 가장 많은 곳, 같으면 ID가 작은 곳. */
function best(list: StorageSpace[], load: Map<number, number>): StorageSpace | undefined {
  let pick: StorageSpace | undefined
  for (const s of list) {
    if (!pick) {
      pick = s
      continue
    }
    const a = remaining(s, load)
    const b = remaining(pick, load)
    if (a > b || (a === b && s.id < pick.id)) pick = s
  }
  return pick
}

function choose(leaves: StorageSpace[], preferred: SpaceTypeCode, load: Map<number, number>): StorageSpace {
  const sameTypeWithRoom = best(leaves.filter((s) => fits(s.spaceType, preferred) && remaining(s, load) > 0), load)
  if (sameTypeWithRoom) return sameTypeWithRoom
  const anyWithRoom = best(leaves.filter((s) => remaining(s, load) > 0), load)
  if (anyWithRoom) return anyWithRoom
  // 모든 공간이 찼으면 같은 유형 중 가장 덜 넘치는 곳을 고르고, 화면에 초과 수량을 보여 준다.
  return best(leaves.filter((s) => fits(s.spaceType, preferred)), load) ?? best(leaves, load)!
}

function reason(g: Garment, season: Season, preferred: SpaceTypeCode, chosen: StorageSpace): string {
  let why: string
  switch (preferred) {
    case 'LONG_TERM': why = `이번 계절(${Season.label(season)}) 옷이 아니어서 장기보관 공간을 우선했어요.`; break
    case 'HANG': why = '형태 유지가 필요한 옷이라 걸기 공간을 우선했어요.'; break
    case 'FOLD': why = '접어서 보관해도 되는 옷이라 접기 공간을 우선했어요.'; break
    // preferredType()은 위 세 유형만 돌려준다.
    default: why = ''
  }
  if (!fits(chosen.spaceType, preferred)) {
    why += ` 해당 유형에 남는 자리가 없어 ${SpaceType.label(chosen.spaceType)} 공간을 골랐어요.`
  }
  if (g.wearFrequency === 'HIGH') why += ' 자주 입는 옷이에요.'
  return why
}

/** garmentIds가 비어 있으면 미배치 옷 전체에 대해 추천한다. 같은 옷의 이전 미확정 추천은 새 추천으로 바꾼다. */
async function recommend(userId: number, garmentIds: (number | null)[] | null) {
  const leaves = await leafSpaces(userId)
  if (!leaves.length) throw ApiError.badRequest("먼저 '공간 추가'로 수납 공간을 만들어 주세요.")
  const ctx = await loadContext(userId)
  const all = await loadGarments(userId)
  const targets: Garment[] = []
  if (!garmentIds || !garmentIds.length) {
    targets.push(...all.filter((g) => ctx.needsPlacement(g)))
  } else {
    for (const id of garmentIds) targets.push(await owned(userId, id as number))
  }
  if (!targets.length) throw ApiError.badRequest('배치할 옷이 없어요. 모든 옷의 위치가 정해져 있어요.')
  for (const g of targets) {
    if (GarmentStatus.isAway(ctx.status(g))) {
      throw ApiError.conflict(`'${g.name}'은(는) 세탁·수선 중이라 지금 배치할 수 없어요.`)
    }
  }
  await deleteByGarmentIds(targets.map((g) => g.id))

  const load = confirmedLoad(all, ctx)
  const season = currentSeason()
  // 자주 입는 옷부터 자리를 잡게 한다.
  const ordered = [...targets].sort((a, b) => WearFrequency.ordinal(a.wearFrequency) - WearFrequency.ordinal(b.wearFrequency) || a.id - b.id)
  for (const g of ordered) {
    const preferred = preferredType(g, season)
    const chosen = choose(leaves, preferred, load)
    load.set(chosen.id, (load.get(chosen.id) ?? 0) + 1)
    await run('INSERT INTO placement_proposals (garment_id, space_id, reason, created_at) VALUES (?, ?, ?, ?)',
      [g.id, chosen.id, reason(g, season, preferred, chosen), new Date()])
  }
  return pending(userId)
}

/** 내 옷의 추천. 추천이 없으면 '배치 추천', 남의 옷이면 '옷'을 찾을 수 없다(Spring과 같다). */
async function ownedProposal(userId: number, proposalId: number): Promise<Proposal> {
  const r = await one('SELECT id, garment_id, space_id, reason FROM placement_proposals WHERE id = ?', [proposalId])
  if (!r) throw ApiError.notFound('배치 추천')
  const p = fromRow(r)
  await owned(userId, p.garmentId)
  return p
}

placementsRouter.get('/placements', handle(async (req) => pending(currentUser(req))))

placementsRouter.post('/placements/recommend', handle(async (req) => {
  const b = req.body
  let garmentIds: (number | null)[] | null = null
  if (b !== undefined && b !== null) {
    if (typeof b !== 'object' || Array.isArray(b)) throw malformed()
    const v = (b as Record<string, unknown>).garmentIds
    if (v !== undefined && v !== null) {
      if (!Array.isArray(v)) throw malformed()
      garmentIds = v.map(long)
    }
  }
  const userId = currentUser(req)
  return tx(() => recommend(userId, garmentIds))
}))

/** 사용자가 추천 공간을 바꾼다. 여전히 미확정이다. */
placementsRouter.put('/placements/:id', handle(async (req) => {
  const id = idParam(req)
  const b = req.body
  if (b === undefined || b === null || typeof b !== 'object' || Array.isArray(b)) throw malformed()
  const spaceId = long((b as Record<string, unknown>).spaceId)
  new Check().when(spaceId == null, '공간을 골라 주세요.').done()
  const userId = currentUser(req)
  return tx(async () => {
    const p = await ownedProposal(userId, id)
    await requireLeafSpace(userId, spaceId!)
    await run('UPDATE placement_proposals SET space_id = ?, reason = ? WHERE id = ?', [spaceId, '직접 고른 공간이에요.', p.id])
    return pending(userId)
  })
}))

/** 실제로 옷을 넣은 뒤 '배치 완료'를 누르면 위치를 확정하고 추천을 지운다. */
placementsRouter.post('/placements/:id/apply', handle(async (req) => {
  const id = idParam(req)
  const userId = currentUser(req)
  return tx(async () => {
    const p = await ownedProposal(userId, id)
    const g = await owned(userId, p.garmentId)
    if (GarmentStatus.isAway((await loadContext(userId)).status(g))) {
      throw ApiError.conflict('세탁·수선 중인 옷은 회수 완료 후에 배치할 수 있어요.')
    }
    // 추천 뒤에 그 공간 안에 다른 공간이 생겼을 수 있다.
    await requireLeafSpace(userId, p.spaceId)
    await place(g.id, p.spaceId)
    await run('DELETE FROM placement_proposals WHERE id = ?', [p.id])
    return pending(userId)
  })
}))

placementsRouter.delete('/placements/:id', handle(async (req) => {
  const id = idParam(req)
  const userId = currentUser(req)
  return tx(async () => {
    const p = await ownedProposal(userId, id)
    await run('DELETE FROM placement_proposals WHERE id = ?', [p.id])
    return pending(userId)
  })
}))
