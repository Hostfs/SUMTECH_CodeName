// 코디: 지금 바로 입을 수 있는 옷(집 안·사용 가능)만 코디에 넣고, 저장한 코디는 옷이 옮겨지면 경고한다.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Client, find, startServer, uniq, type TestServer } from './helpers.js'

let srv: TestServer
const client = () => new Client(srv.base)

before(async () => {
  srv = await startServer()
})

after(async () => {
  await srv?.close()
})

/** 새 계정에 옷장 A → 왼쪽 행거(집 안)와 여름 박스(박스)를 만든다. */
async function closet() {
  const c = client()
  await c.post('/api/auth/signup', { email: `outfit${uniq()}@example.com`, password: 'password123' })
  const top = (await c.post('/api/spaces', { name: '옷장 A', spaceType: 'HANG' })).body.spaces[0].id
  const hanger = find((await c.post('/api/spaces', { name: '왼쪽 행거', parentId: top, spaceType: 'HANG' })).body.spaces, '왼쪽 행거').id
  const box = find((await c.post('/api/spaces', { name: '여름 박스', spaceType: 'BOX' })).body.spaces, '여름 박스').id
  const add = async (name: string, subType: string, spaceId: number | null, seasons: string[] = []) =>
    (await c.post('/api/garments', { name, subType, seasons, ...(spaceId ? { spaceId } : {}) })).body.summary.id as number
  return { c, hanger, box, add }
}

test('createLookFromHomeGarmentsAndList', async () => {
  const { c, hanger, add } = await closet()
  const shirt = await add('네이비 셔츠', 'SHIRT', hanger)
  const pants = await add('블랙 슬랙스', 'PANTS', hanger)
  const jacket = await add('울 재킷', 'JACKET', hanger)

  const r = await c.post('/api/outfits', {
    name: '  출근룩 ',
    items: [{ slot: 'TOP', garmentId: shirt }, { slot: 'BOTTOM', garmentId: pants }, { slot: 'OUTER', garmentId: jacket }],
  })
  assert.equal(r.status, 201, r.raw)
  assert.equal(r.body.name, '출근룩')
  assert.deepEqual(r.body.items.map((i: any) => i.slot), ['OUTER', 'TOP', 'BOTTOM'])
  assert.equal(r.body.items[1].garment.locationPath, '옷장 A → 왼쪽 행거')
  assert.equal(r.body.wearableNow, true)
  assert.deepEqual(r.body.awayItems, [])

  await c.post('/api/outfits', { name: '두 번째', items: [{ slot: 'TOP', garmentId: shirt }] })
  const list = (await c.get('/api/outfits')).body
  assert.deepEqual(list.map((l: any) => l.name), ['두 번째', '출근룩'])
})

test('rejectsBoxGarmentWithItsLocation', async () => {
  const { c, hanger, box, add } = await closet()
  const pants = await add('블랙 슬랙스', 'PANTS', hanger)
  const linen = await add('린넨 반소매 셔츠', 'SHIRT', box)
  const r = await c.post('/api/outfits', { name: '여름', items: [{ slot: 'TOP', garmentId: linen }, { slot: 'BOTTOM', garmentId: pants }] })
  assert.equal(r.status, 409)
  assert.equal(r.body.error, "'린넨 반소매 셔츠'은(는) 지금 박스 속 · 여름 박스에 있어 코디에 넣을 수 없어요.")

  // 자리가 정해지지 않은 옷도 지금 입을 옷으로 보지 않는다
  const loose = await add('미배치 티', 'SHORT_SLEEVE_TEE', null)
  assert.equal((await c.post('/api/outfits', { name: '미배치', items: [{ slot: 'TOP', garmentId: loose }] })).status, 409)
})

test('validatesNameSlotsAndCategory', async () => {
  const { c, hanger, add } = await closet()
  const shirt = await add('셔츠', 'SHIRT', hanger)
  const dress = await add('원피스', 'DRESS', hanger)
  const pants = await add('바지', 'PANTS', hanger)

  const noName = await c.post('/api/outfits', { name: ' ', items: [{ slot: 'TOP', garmentId: shirt }] })
  assert.equal(noName.status, 400)
  assert.ok(noName.body.error.includes('코디 이름을 입력해 주세요.'), noName.body.error)
  assert.equal((await c.post('/api/outfits', { name: 'x'.repeat(51), items: [{ slot: 'TOP', garmentId: shirt }] })).status, 400)
  assert.equal((await c.post('/api/outfits', { name: '빈 코디', items: [] })).status, 400)

  const wrongSlot = await c.post('/api/outfits', { name: '잘못', items: [{ slot: 'BOTTOM', garmentId: shirt }] })
  assert.equal(wrongSlot.status, 400)
  assert.ok(wrongSlot.body.error.includes('하의 자리'), wrongSlot.body.error)
  assert.equal((await c.post('/api/outfits', { name: '중복', items: [{ slot: 'TOP', garmentId: shirt }, { slot: 'TOP', garmentId: shirt }] })).status, 400)
  assert.equal((await c.post('/api/outfits', { name: '원피스+하의', items: [{ slot: 'DRESS', garmentId: dress }, { slot: 'BOTTOM', garmentId: pants }] })).status, 400)
  assert.equal((await c.post('/api/outfits', { name: '모자', items: [{ slot: 'HAT', garmentId: shirt }] })).status, 400)
  assert.equal((await c.post('/api/outfits', { name: '원피스', items: [{ slot: 'DRESS', garmentId: dress }] })).status, 201)
})

test('otherUsersGarmentsAndLooksAre404', async () => {
  const a = await closet()
  const b = await closet()
  const shirt = await a.add('셔츠', 'SHIRT', a.hanger)
  assert.equal((await b.c.post('/api/outfits', { name: '남의 옷', items: [{ slot: 'TOP', garmentId: shirt }] })).status, 404)

  const look = (await a.c.post('/api/outfits', { name: '내 코디', items: [{ slot: 'TOP', garmentId: shirt }] })).body.id
  assert.equal((await b.c.send('DELETE', `/api/outfits/${look}`)).status, 404)
  assert.equal((await b.c.get('/api/outfits')).body.length, 0)
  assert.equal((await a.c.send('DELETE', `/api/outfits/${look}`)).status, 204)
  assert.equal((await a.c.get('/api/outfits')).body.length, 0)
  assert.equal((await a.c.send('DELETE', `/api/outfits/${look}`)).status, 404)
})

test('savedLookWarnsWhenGarmentMovesAway', async () => {
  const { c, hanger, box, add } = await closet()
  const shirt = await add('린넨 셔츠', 'SHIRT', hanger)
  const look = (await c.post('/api/outfits', { name: '여름 코디', items: [{ slot: 'TOP', garmentId: shirt }] })).body.id
  assert.equal((await c.post(`/api/garments/${shirt}/confirm-placement`, { spaceId: box })).status, 200)
  const saved = find((await c.get('/api/outfits')).body, '여름 코디')
  assert.equal(saved.id, look)
  assert.equal(saved.wearableNow, false)
  assert.deepEqual(saved.awayItems, ['린넨 셔츠'])
  assert.equal(saved.items[0].garment.locationKind, 'BOX')

  // 옷을 지우면 그 자리만 빠지고, 남은 옷이 없는 코디는 목록에서 사라진다
  assert.equal((await c.send('DELETE', `/api/garments/${shirt}`)).status, 204)
  assert.equal((await c.get('/api/outfits')).body.length, 0)
})

test('suggestUsesOnlyHomeGarments', async () => {
  const { c, hanger, box, add } = await closet()
  await add('박스 코트', 'COAT', box, ['WINTER'])
  await add('박스 니트', 'KNIT', box, ['WINTER'])
  const coat = await add('집 코트', 'COAT', hanger, ['WINTER'])
  const tee = await add('집 반팔', 'SHORT_SLEEVE_TEE', hanger, ['SUMMER'])
  const pants = await add('집 바지', 'PANTS', hanger, [])

  const winter = await c.get('/api/outfits/suggest?season=WINTER')
  assert.equal(winter.status, 200)
  assert.deepEqual(winter.body.items.map((i: any) => [i.slot, i.garment.id]), [['OUTER', coat], ['TOP', tee], ['BOTTOM', pants]])
  for (const i of winter.body.items) assert.equal(i.garment.locationKind, 'HOME')
  assert.ok(winter.body.reason.length > 0)

  const summer = (await c.get('/api/outfits/suggest?season=SUMMER')).body
  assert.deepEqual(summer.items.map((i: any) => i.slot), ['TOP', 'BOTTOM'])
  assert.equal((await c.get('/api/outfits/suggest')).status, 200)
  assert.equal((await c.get('/api/outfits/suggest?season=RAINY')).status, 400)

  // 시드 계정: 세탁·수선 중(니트·치노)과 미배치(데님)는 추천에 나오지 않는다
  const seed = await client().login()
  const names = (await seed.get('/api/outfits/suggest?season=AUTUMN')).body.items.map((i: any) => i.garment.name)
  for (const away of ['베이지 니트', '카키 치노 팬츠', '연청 데님 팬츠']) assert.ok(!names.includes(away), names.join(','))
})
