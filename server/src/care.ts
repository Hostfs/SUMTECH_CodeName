import { Router, type Request } from 'express'
import { one, run, tx } from './db.js'
import { isDate, today } from './dates.js'
import { CarePlace, CareType, type CarePlace as CarePlaceCode, type CareType as CareTypeCode } from './domain.js'
import { ApiError, Check, handle, idParam, isBlank } from './http.js'
import { currentUser } from './session.js'
import {
  careByOwner, careFromRow, careView, insertCare, loadContext, loadGarments, openCareOf, owned, summary, touch, type CareEvent,
} from './core.js'

/**
 * 세탁·수선·회수 관리(Spring의 CareController). 세탁 중·수선 중·회수 후 위치 미확인은 이 기록에서 계산되므로 옷의 상태를 따로 바꾸지 않는다.
 * '오늘 회수 예정'과 '기한 지남'은 요청할 때마다 오늘 날짜로 다시 계산한다.
 */
export const careRouter = Router()

const malformed = () => new ApiError(400, '입력 형식이 올바르지 않아요.')

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

function date(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null
  if (isDate(v)) return v
  throw malformed()
}

function enumOf<K extends string>(v: unknown, has: (x: unknown) => x is K): K | null {
  if (v === undefined || v === null) return null
  if (has(v)) return v
  throw malformed()
}

const blankToNull = (v: string | null) => (v == null || isBlank(v) ? null : v.trim())

/** 관리함. 배지 숫자는 dueToday·overdue 길이로 표시한다. */
export async function board(userId: number) {
  const now = today()
  const [ctx, all, cares] = await Promise.all([loadContext(userId), loadGarments(userId), careByOwner(userId)])
  const byId = new Map(all.map((g) => [g.id, g]))
  const items = cares.map((c) => ({
    care: careView(c),
    garment: summary(byId.get(c.garmentId)!, ctx),
    overdue: c.completedAt == null && c.dueOn != null && c.dueOn < now,
    dueToday: c.completedAt == null && c.dueOn === now,
  }))
  const open = items.filter((i) => i.care.completedAt == null)
  const done = items
    .filter((i) => i.care.completedAt != null)
    .sort((a, b) => (a.care.completedAt! < b.care.completedAt! ? 1 : a.care.completedAt! > b.care.completedAt! ? -1 : 0))
    .slice(0, 30)
  return {
    today: now,
    dueToday: open.filter((i) => i.dueToday),
    overdue: open.filter((i) => i.overdue),
    inProgress: open,
    history: done,
  }
}

function validateDue(dropped: string, due: string | null) {
  if (due != null && due < dropped) throw ApiError.badRequest('회수 예정일은 맡긴 날짜보다 앞설 수 없어요.')
}

async function openEvent(userId: number, id: number): Promise<CareEvent> {
  const r = await one(`SELECT c.id, c.garment_id, c.care_type_code, c.place_code, c.shop_name, c.description, c.dropped_on, c.due_on,
    c.completed_at, c.created_at FROM care_events c JOIN garments g ON g.id = c.garment_id WHERE c.id = ? AND g.user_id = ?`, [id, userId])
  if (!r) throw ApiError.notFound('세탁·수선 기록')
  const c = careFromRow(r)
  if (c.completedAt != null) throw ApiError.conflict('이미 회수 완료된 기록이에요.')
  return c
}

careRouter.get('/care', handle(async (req) => board(currentUser(req))))

/** 세탁·수선 맡기기. 옷은 세탁 중·수선 중으로 계산되어 코디 추천에서 빠진다. */
careRouter.post('/garments/:garmentId/care', handle(async (req) => {
  const garmentId = idParam(req, 'garmentId')
  const b = bodyOf(req)
  const careType = enumOf<CareTypeCode>(b.careType, CareType.has)
  const place = enumOf<CarePlaceCode>(b.place, CarePlace.has)
  const shopName = str(b.shopName)
  const description = str(b.description)
  const droppedOn = date(b.droppedOn)
  const dueOn = date(b.dueOn)
  new Check()
    .when(careType == null, '세탁인지 수선인지 골라 주세요.')
    .when(place == null, '맡긴 곳을 골라 주세요.')
    .when(shopName != null && shopName.length > 100, '업체명은 100자까지 쓸 수 있어요.')
    .when(description != null && description.length > 500, '내용은 500자까지 쓸 수 있어요.')
    .done()
  const userId = currentUser(req)
  return tx(async () => {
    const g = await owned(userId, garmentId)
    if (await openCareOf(g.id)) throw ApiError.conflict('이미 진행 중인 세탁·수선 기록이 있어요. 관리함에서 확인해 주세요.')
    const now = today()
    const dropped = droppedOn ?? now
    if (dropped > now) throw ApiError.badRequest('맡긴 날짜는 오늘이나 그 이전이어야 해요.')
    validateDue(dropped, dueOn)
    if (place === 'HOME' && shopName != null && !isBlank(shopName)) throw ApiError.badRequest('자택 세탁에는 업체명을 쓰지 않아요.')
    await insertCare({
      garmentId: g.id, careType: careType!, place: place!, shopName: blankToNull(shopName), description: blankToNull(description),
      droppedOn: dropped, dueOn,
    })
    await touch(g.id)
    return board(userId)
  })
}, 201))

/** 예정일 변경, 세탁 → 수선 전환 등. 옷의 상태는 기록에서 계산되므로 따로 바꾸지 않는다. */
careRouter.patch('/care/:id', handle(async (req) => {
  const id = idParam(req)
  const b = bodyOf(req)
  const careType = enumOf<CareTypeCode>(b.careType, CareType.has)
  const shopName = str(b.shopName)
  const description = str(b.description)
  const dueOn = date(b.dueOn)
  new Check()
    .when(shopName != null && shopName.length > 100, 'size must be between 0 and 100')
    .when(description != null && description.length > 500, 'size must be between 0 and 500')
    .done()
  const userId = currentUser(req)
  return tx(async () => {
    const c = await openEvent(userId, id)
    if (dueOn != null) {
      validateDue(c.droppedOn, dueOn)
      c.dueOn = dueOn
    }
    if (shopName != null) {
      if (c.place === 'HOME' && !isBlank(shopName)) throw ApiError.badRequest('자택 세탁에는 업체명을 쓰지 않아요.')
      c.shopName = blankToNull(shopName)
    }
    if (description != null) c.description = blankToNull(description)
    if (careType != null) c.careType = careType
    await run('UPDATE care_events SET care_type_code = ?, shop_name = ?, description = ?, due_on = ? WHERE id = ?',
      [c.careType, c.shopName, c.description, c.dueOn, c.id])
    return board(userId)
  })
}))

/** 회수 완료. 진행 중 목록에서 빠지고, 옷은 기존 위치를 제안받는 '회수 완료·위치 미확인'으로 계산된다. */
careRouter.post('/care/:id/complete', handle(async (req) => {
  const id = idParam(req)
  const userId = currentUser(req)
  return tx(async () => {
    const c = await openEvent(userId, id)
    await run('UPDATE care_events SET completed_at = ? WHERE id = ?', [new Date(), c.id])
    const g = await owned(userId, c.garmentId)
    // 세탁 대기였던 옷이 세탁을 마치고 돌아오면 더는 세탁 대기가 아니다.
    if (c.careType === 'WASH' && g.homeStatus === 'WASH_WAITING') {
      await run('UPDATE garments SET status_code = ? WHERE id = ?', ['STORED', g.id])
    }
    await touch(g.id)
    return board(userId)
  })
}))
