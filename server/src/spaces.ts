import { Router, type Request } from 'express'
import { inList, one, run, tx } from './db.js'
import { SpaceType, type SpaceType as SpaceTypeCode } from './domain.js'
import { ApiError, Check, handle, idParam, isBlank } from './http.js'
import { currentUser } from './session.js'
import { loadContext, loadGarments, ownedSpace, parentMap, placeDirectly, spacesOf, summary } from './core.js'

/** 옷장 지도: 수납 공간과 공간별 옷, 미배치 목록(Spring의 SpaceController). */
export const spacesRouter = Router()

const malformed = () => new ApiError(400, '입력 형식이 올바르지 않아요.')

/** @RequestBody 객체. 없거나 객체가 아니면 읽지 못한 본문과 같게 400. */
function bodyOf(req: Request): Record<string, unknown> {
  const b = req.body
  if (b === undefined || b === null || typeof b !== 'object' || Array.isArray(b)) throw malformed()
  return b as Record<string, unknown>
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  throw malformed()
}

function long(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && /^\s*-?\d+\s*$/.test(v)) return Number(v)
  throw malformed()
}

function longList(v: unknown): (number | null)[] | null {
  if (v === undefined || v === null) return null
  if (!Array.isArray(v)) throw malformed()
  return v.map(long)
}

function spaceType(v: unknown): SpaceTypeCode | null {
  if (v === undefined || v === null) return null
  if (SpaceType.has(v)) return v
  throw malformed()
}

/** 옷장 지도 전체(공간 ID 순, 공간마다 들어 있는 옷과 미배치 옷은 최근 등록순). */
export async function mapView(userId: number) {
  const [ctx, parentOf, all, spaces] = await Promise.all([loadContext(userId), parentMap(userId), loadGarments(userId), spacesOf(userId)])
  const views = spaces.map((s) => {
    // 공간에 실제로 들어 있는 옷: 위치가 확정되었고 집에 있으며 회수 후 미확인이 아닌 옷
    const inSpace = all
      .filter((g) => ctx.locationConfirmed(g) && ctx.placements.get(g.id)!.spaceId === s.id)
      .map((g) => summary(g, ctx))
    const overBy = s.capacity == null ? 0 : Math.max(0, inSpace.length - s.capacity)
    return {
      id: s.id,
      parentId: parentOf.get(s.id) ?? null,
      name: s.name,
      path: ctx.paths.get(s.id) ?? null,
      spaceType: s.spaceType,
      spaceTypeLabel: SpaceType.label(s.spaceType),
      capacity: s.capacity,
      count: inSpace.length,
      overBy,
      garments: inSpace,
    }
  })
  const unplaced = all.filter((g) => ctx.needsPlacement(g)).map((g) => summary(g, ctx))
  return { spaces: views, unplaced }
}

interface SpaceInput { name: string; parentId: number | null; spaceType: SpaceTypeCode; capacity: number | null }

function spaceInput(req: Request): SpaceInput {
  const b = bodyOf(req)
  const name = str(b.name)
  const parentId = long(b.parentId)
  const type = spaceType(b.spaceType)
  const capacity = long(b.capacity)
  new Check()
    .when(isBlank(name), '공간 이름을 입력해 주세요.')
    .when(name != null && name.length > 100, '공간 이름은 100자까지 쓸 수 있어요.')
    .when(type == null, '공간 유형을 골라 주세요.')
    .when(capacity != null && capacity < 1, '수용 개수는 1 이상이어야 해요.')
    .when(capacity != null && capacity > 500, '수용 개수는 500 이하여야 해요.')
    .done()
  return { name: name!.trim(), parentId, spaceType: type!, capacity }
}

async function placementCount(spaceId: number): Promise<number> {
  const r = await one('SELECT COUNT(*) AS n FROM garment_placements WHERE space_id = ?', [spaceId])
  return Number(r?.n ?? 0)
}

/** 상위 공간을 정한다. 내 공간만, 순환 없이. */
async function setParent(userId: number, spaceId: number, parentId: number | null) {
  if (parentId == null) {
    await run('DELETE FROM storage_space_parents WHERE space_id = ?', [spaceId])
    return
  }
  if (!(await ownedSpace(userId, parentId))) throw ApiError.notFound('상위 공간')
  if ((await placementCount(parentId)) > 0) {
    throw ApiError.badRequest('옷이 들어 있는 공간 안에는 다른 공간을 만들 수 없어요. 옷을 먼저 옮겨 주세요.')
  }
  const parentOf = await parentMap(userId)
  for (let cur: number | undefined = parentId; cur !== undefined; cur = parentOf.get(cur)) {
    if (cur === spaceId) throw ApiError.badRequest('공간을 자기 자신이나 자기 안쪽 공간 안에 넣을 수 없어요.')
  }
  await run(`INSERT INTO storage_space_parents (space_id, parent_space_id) VALUES (?, ?)
    ON DUPLICATE KEY UPDATE parent_space_id = VALUES(parent_space_id)`, [spaceId, parentId])
}

spacesRouter.get('/spaces', handle(async (req) => mapView(currentUser(req))))

spacesRouter.post('/spaces', handle(async (req) => {
  const body = spaceInput(req)
  const userId = currentUser(req)
  return tx(async () => {
    const r = await run('INSERT INTO storage_spaces (user_id, name, space_type_code, capacity, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, body.name, body.spaceType, body.capacity, new Date()])
    await setParent(userId, r.insertId, body.parentId)
    return mapView(userId)
  })
}, 201))

spacesRouter.put('/spaces/:id', handle(async (req) => {
  const id = idParam(req)
  const body = spaceInput(req)
  const userId = currentUser(req)
  return tx(async () => {
    const space = await ownedSpace(userId, id)
    if (!space) throw ApiError.notFound('공간')
    await run('UPDATE storage_spaces SET name = ?, space_type_code = ?, capacity = ? WHERE id = ?', [body.name, body.spaceType, body.capacity, space.id])
    await setParent(userId, space.id, body.parentId)
    return mapView(userId)
  })
}))

/** 고른 옷을 이 공간에 바로 넣는다(위치 확정). 그 옷들의 미확정 배치 추천은 지운다. */
spacesRouter.post('/spaces/:id/garments', handle(async (req) => {
  const id = idParam(req)
  const garmentIds = longList(bodyOf(req).garmentIds)
  new Check()
    .when(garmentIds == null || garmentIds.length === 0, '넣을 옷을 골라 주세요.')
    .when(garmentIds != null && garmentIds.length > 200, 'size must be between 0 and 200')
    .done()
  const userId = currentUser(req)
  return tx(async () => {
    await placeDirectly(userId, id, garmentIds as number[])
    await run('DELETE FROM placement_proposals WHERE garment_id IN (?)', inList(garmentIds!))
    return mapView(userId)
  })
}))

spacesRouter.delete('/spaces/:id', handle(async (req) => {
  const id = idParam(req)
  const userId = currentUser(req)
  return tx(async () => {
    const space = await ownedSpace(userId, id)
    if (!space) throw ApiError.notFound('공간')
    if ((await placementCount(id)) > 0) {
      throw ApiError.conflict('이 공간에 옷이 있어요. 옷을 다른 곳으로 옮긴 뒤 삭제해 주세요.')
    }
    // 바깥 공간을 지우면 안쪽 공간이 조용히 최상위가 되므로 막는다.
    if (await one('SELECT 1 AS x FROM storage_space_parents WHERE parent_space_id = ? LIMIT 1', [id])) {
      throw ApiError.conflict('이 공간 안에 다른 공간이 있어요. 안쪽 공간부터 삭제해 주세요.')
    }
    await run('DELETE FROM storage_spaces WHERE id = ?', [space.id])
    return mapView(userId)
  })
}))
