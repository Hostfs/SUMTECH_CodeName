import { Router, type Request } from 'express'
import { inList, one, query, run, tx } from './db.js'
import { instant, isDate, today } from './dates.js'
import { SpaceType, type SpaceType as SpaceTypeCode } from './domain.js'
import { ApiError, Check, handle, isBlank } from './http.js'
import { currentUser } from './session.js'
import {
  careFromRow, imageUrl, insertCare, loadContext, loadGarments, openCareOf, owned, ownedSpace, placeDirectly, spacesOf, summary, touch,
  type ClosetContext, type Garment, type StorageSpace,
} from './core.js'

/**
 * R11 옮기는 단위 묶음 기록(Spring의 MoveController). 옷 여러 벌을 한 번에 박스·집 밖 공간으로 옮기거나 세탁소에 맡긴다.
 * 공간으로 옮기면 각 옷의 확정 위치가 바뀌고, 세탁소면 옷마다 세탁 기록(R08)이 생겨 관리함에서 회수를 챙긴다.
 */
export const movesRouter = Router()

type Destination = 'SPACE' | 'LAUNDRY'

const malformed = () => new ApiError(400, '입력 형식이 올바르지 않아요.')

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
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

function date(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null
  if (isDate(v)) return v
  throw malformed()
}

function enumOf<K extends string>(v: unknown, keys: readonly K[]): K | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string' && (keys as readonly string[]).includes(v)) return v as K
  throw malformed()
}

interface MoveInput {
  destination: Destination
  spaceId: number | null
  newSpace: { name: string; spaceType: SpaceTypeCode } | null
  shopName: string | null
  movedOn: string | null
  dueOn: string | null
  garmentIds: number[]
  imageIds: number[] | null
}

function moveInput(req: Request): MoveInput {
  const b = req.body
  if (!isObject(b)) throw malformed()
  const destination = enumOf<Destination>(b.destination, ['SPACE', 'LAUNDRY'])
  const spaceId = long(b.spaceId)
  let newSpace: { name: string | null; spaceType: SpaceTypeCode | null } | null = null
  if (b.newSpace !== undefined && b.newSpace !== null) {
    if (!isObject(b.newSpace)) throw malformed()
    newSpace = { name: str(b.newSpace.name), spaceType: enumOf(b.newSpace.spaceType, SpaceType.keys) }
  }
  const shopName = str(b.shopName)
  const movedOn = date(b.movedOn)
  const dueOn = date(b.dueOn)
  const garmentIds = longList(b.garmentIds)
  const imageIds = longList(b.imageIds)
  new Check()
    .when(destination == null, '보낼 곳을 골라 주세요.')
    .when(newSpace != null && isBlank(newSpace.name), '보낼 곳 이름을 입력해 주세요.')
    .when(newSpace?.name != null && newSpace.name.length > 100, '이름은 100자까지 쓸 수 있어요.')
    .when(newSpace != null && newSpace.spaceType == null, '박스인지 집 밖인지 골라 주세요.')
    .when(shopName != null && shopName.length > 100, '업체명은 100자까지 쓸 수 있어요.')
    .when(garmentIds == null || garmentIds.length === 0, '옮길 옷을 골라 주세요.')
    .when(garmentIds != null && garmentIds.length > 200, 'size must be between 0 and 200')
    .when(imageIds != null && imageIds.length > 4, '사진은 4장까지 남길 수 있어요.')
    .done()
  return {
    destination: destination!,
    spaceId,
    newSpace: newSpace as MoveInput['newSpace'],
    shopName,
    movedOn,
    dueOn,
    garmentIds: garmentIds as number[],
    imageIds: imageIds as number[] | null,
  }
}

interface Batch { id: number; createdAt: Date; imageIds: number[] }
interface BatchSpace { spaceId: number; movedOn: string; garmentIds: number[] }

/** 저장된 묶음의 목적지. 공간으로 보낸 묶음이 아니면 undefined. */
async function batchSpace(batchId: number): Promise<BatchSpace | undefined> {
  const r = await one('SELECT space_id, moved_on FROM move_batch_spaces WHERE batch_id = ?', [batchId])
  if (!r) return undefined
  const garments = await query('SELECT garment_id FROM move_batch_space_garments WHERE batch_id = ? ORDER BY garment_id', [batchId])
  return { spaceId: r.space_id, movedOn: r.moved_on, garmentIds: garments.map((g) => g.garment_id) }
}

function summaries(ids: Iterable<number>, byId: Map<number, Garment>, ctx: ClosetContext) {
  const out = []
  for (const id of ids) {
    const g = byId.get(id)
    if (g) out.push(summary(g, ctx))
  }
  return out
}

/**
 * 묶음 화면 값. justMoved는 방금 저장한 묶음의 목적지(옷 순서를 입력 순서대로 보여 준다. Spring은 같은 영속성 컨텍스트의 값을 썼다).
 */
async function views(userId: number, list: Batch[], justMoved?: Map<number, BatchSpace>) {
  const [ctx, all, spaces] = await Promise.all([loadContext(userId), loadGarments(userId), spacesOf(userId)])
  const byId = new Map(all.map((g) => [g.id, g]))
  const spaceById = new Map<number, StorageSpace>(spaces.map((s) => [s.id, s]))
  const out = []
  for (const b of list) {
    const urls = [...b.imageIds].sort((x, y) => x - y).map((id) => imageUrl(id))
    const dest = justMoved?.get(b.id) ?? await batchSpace(b.id)
    if (dest) {
      const s = spaceById.get(dest.spaceId)
      out.push({
        id: b.id, createdAt: instant(b.createdAt), destination: 'SPACE', spaceId: dest.spaceId, spacePath: ctx.paths.get(dest.spaceId) ?? null,
        spaceType: s ? s.spaceType : null, shopName: null, movedOn: dest.movedOn, dueOn: null,
        garments: summaries(dest.garmentIds, byId, ctx), imageUrls: urls,
      })
    } else {
      const cares = (await query(`SELECT c.id, c.garment_id, c.care_type_code, c.place_code, c.shop_name, c.description, c.dropped_on, c.due_on,
        c.completed_at, c.created_at FROM care_events c JOIN move_batch_care_events m ON m.care_event_id = c.id
        WHERE m.batch_id = ? ORDER BY c.id`, [b.id])).map(careFromRow)
      const first = cares[0]
      const ids = new Set(cares.map((c) => c.garmentId))
      out.push({
        id: b.id, createdAt: instant(b.createdAt), destination: 'LAUNDRY', spaceId: null, spacePath: null, spaceType: null,
        shopName: first ? first.shopName : null, movedOn: first ? first.droppedOn : null, dueOn: first ? first.dueOn : null,
        garments: summaries(ids, byId, ctx), imageUrls: urls,
      })
    }
  }
  return out
}

async function targetSpace(userId: number, input: MoveInput): Promise<StorageSpace> {
  if (input.spaceId != null) {
    const s = await ownedSpace(userId, input.spaceId)
    if (!s) throw ApiError.notFound('공간')
    return s
  }
  if (!input.newSpace) throw ApiError.badRequest('보낼 박스나 장소를 골라 주세요.')
  if (input.newSpace.spaceType !== 'BOX' && input.newSpace.spaceType !== 'OFFSITE') {
    throw ApiError.badRequest('새로 만드는 곳은 박스나 집 밖만 고를 수 있어요.')
  }
  const createdAt = new Date()
  const name = input.newSpace.name.trim()
  const r = await run('INSERT INTO storage_spaces (user_id, name, space_type_code, capacity, created_at) VALUES (?, ?, ?, NULL, ?)',
    [userId, name, input.newSpace.spaceType, createdAt])
  return { id: r.insertId, userId, name, spaceType: input.newSpace.spaceType, capacity: null, createdAt }
}

async function insertBatch(userId: number, imageIds: number[]): Promise<Batch> {
  const createdAt = new Date()
  const r = await run('INSERT INTO move_batches (user_id, created_at) VALUES (?, ?)', [userId, createdAt])
  if (imageIds.length) await run('INSERT INTO move_batch_images (image_id, batch_id) VALUES ?', [imageIds.map((id) => [id, r.insertId])])
  return { id: r.insertId, createdAt, imageIds }
}

/** 최근 묶음(최신순). 화면은 가장 최근 묶음의 보낸 곳·업체를 기본값으로 쓴다. */
movesRouter.get('/moves', handle(async (req) => {
  const userId = currentUser(req)
  const rows = await query('SELECT id, created_at FROM move_batches WHERE user_id = ? ORDER BY id DESC LIMIT 20', [userId])
  const images = await query('SELECT image_id, batch_id FROM move_batch_images WHERE batch_id IN (?) ORDER BY image_id', inList(rows.map((r) => r.id)))
  const list: Batch[] = rows.map((r) => ({
    id: r.id, createdAt: r.created_at, imageIds: images.filter((i) => i.batch_id === r.id).map((i) => i.image_id),
  }))
  return views(userId, list)
}))

movesRouter.post('/moves', handle(async (req) => {
  const input = moveInput(req)
  const userId = currentUser(req)
  return tx(async () => {
    const garmentIds = [...new Set(input.garmentIds)]
    const moving: Garment[] = []
    for (const id of garmentIds) moving.push(await owned(userId, id))
    const now = today()
    const movedOn = input.movedOn ?? now
    if (movedOn > now) throw ApiError.badRequest('옮긴 날짜는 오늘이나 그 이전이어야 해요.')

    const imageIds: number[] = []
    for (const imageId of input.imageIds ?? []) {
      if (!(await one('SELECT id FROM images WHERE id = ? AND user_id = ?', [imageId, userId]))) throw ApiError.notFound('사진')
      if (!imageIds.includes(imageId)) imageIds.push(imageId)
    }

    if (input.destination === 'SPACE') {
      const target = await targetSpace(userId, input)
      // 가장 안쪽 공간인지, 세탁·수선 중인 옷이 없는지는 직접 넣기와 같은 규칙으로 확인한다.
      await placeDirectly(userId, target.id, garmentIds)
      await run('DELETE FROM placement_proposals WHERE garment_id IN (?)', inList(garmentIds))
      const batch = await insertBatch(userId, imageIds)
      await run('INSERT INTO move_batch_spaces (batch_id, space_id, moved_on) VALUES (?, ?, ?)', [batch.id, target.id, movedOn])
      await run('INSERT INTO move_batch_space_garments (batch_id, garment_id) VALUES ?', [garmentIds.map((id) => [batch.id, id])])
      const dest: BatchSpace = { spaceId: target.id, movedOn, garmentIds }
      return (await views(userId, [batch], new Map([[batch.id, dest]])))[0]
    }

    if (input.dueOn == null) throw ApiError.badRequest('세탁소에 맡길 때는 회수 예정일을 골라 주세요.')
    if (input.dueOn < movedOn) throw ApiError.badRequest('회수 예정일은 맡긴 날짜보다 앞설 수 없어요.')
    const shop = input.shopName == null || isBlank(input.shopName) ? null : input.shopName.trim()
    const careIds: number[] = []
    for (const g of moving) {
      if (await openCareOf(g.id)) {
        throw ApiError.conflict(`'${g.name}'은(는) 이미 세탁·수선 중이에요. 관리함에서 확인해 주세요.`)
      }
      const c = await insertCare({
        garmentId: g.id, careType: 'WASH', place: 'SHOP', shopName: shop, description: null, droppedOn: movedOn, dueOn: input.dueOn,
      })
      careIds.push(c.id)
      await touch(g.id)
    }
    const batch = await insertBatch(userId, imageIds)
    await run('INSERT INTO move_batch_care_events (care_event_id, batch_id) VALUES ?', [careIds.map((id) => [id, batch.id])])
    return (await views(userId, [batch]))[0]
  })
}, 201))
