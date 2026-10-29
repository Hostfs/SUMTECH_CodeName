// OtgyeolApplicationTests 이식: 시드 데이터로 등록·분류·배치·관리·코디 API가 같은 의류 ID로 이어지는지 실제 HTTP와 MariaDB로 확인한다.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Client, field, find, imageById, png, startServer, today, uniq, type TestServer } from './helpers.js'

let srv: TestServer
const client = () => new Client(srv.base)
const login = () => client().login()

before(async () => {
  srv = await startServer()
})

after(async () => {
  await srv?.close()
})

/** 결과가 비어 있는지(Java: isNull()은 JSON null). 없는 속성도 실패로 본다. */
function isJsonNull(obj: any, key: string) {
  assert.ok(obj && key in obj, `${key} missing in ${JSON.stringify(obj)}`)
  assert.equal(obj[key], null, `${key} should be null`)
}

test('healthIsPublicAndReportsRelease', async () => {
  const r = await client().get('/__health')
  assert.equal(r.status, 200)
  assert.equal(r.body.releaseId, 'test-release')
})

test('apiRequiresLoginAndUnknownPathIs404', async () => {
  const c = client()
  assert.equal((await c.get('/api/garments')).status, 401)
  assert.equal((await c.get('/no-such-page')).status, 404)
})

test('metaComesFromDomainTables', async () => {
  const meta = (await (await login()).get('/api/meta')).body
  assert.equal(meta.subTypes.length, 15)
  assert.ok(JSON.stringify(meta.fibers).includes('폴리에스터'))
  assert.equal(meta.spaceTypes[0].label, '걸기')
})

test('signupValidatesAndSeparatesAccounts', async () => {
  const c = client()
  assert.equal((await c.post('/api/auth/signup', { email: 'bad', password: 'short' })).status, 400)
  const email = `new${uniq()}@example.com`
  assert.equal((await c.post('/api/auth/signup', { email, password: 'password123' })).status, 201)
  assert.equal((await c.get('/api/auth/me')).body.email, email)
  assert.equal((await c.get('/api/garments')).body.length, 0)

  const seed = await login()
  // 세탁·수선과 무관한 옷으로 확인한다(세탁 중인 옷은 위치 확정 자체가 409로 먼저 막힌다)
  const seedGarment = find((await seed.get('/api/garments')).body, '그레이 울 재킷').id
  assert.equal((await c.get(`/api/garments/${seedGarment}`)).status, 404)

  // 새 계정의 공간에 시드 계정의 옷을 놓을 수 없다(서버가 404, DB 트리거가 최종 방어)
  const otherSpace = (await c.post('/api/spaces', { name: '남의 행거', spaceType: 'HANG' })).body.spaces[0].id
  assert.equal((await seed.post(`/api/garments/${seedGarment}/confirm-placement`, { spaceId: otherSpace })).status, 404)

  assert.equal((await client().post('/api/auth/login', { email, password: 'wrongpass1' })).status, 401)
})

test('registerWithMaterialsAndClassify', async () => {
  const c = await login()
  const bad = await c.post('/api/garments', {
    name: '테스트 셔츠', subType: 'SHIRT',
    materials: [{ part: 'SHELL', fiber: 'COTTON', percent: 60 }, { part: 'SHELL', fiber: 'POLYESTER', percent: 30 }],
  })
  assert.equal(bad.status, 400)
  assert.ok(bad.body.error.includes('100%'), bad.body.error)

  const created = await c.post('/api/garments', {
    name: '테스트 셔츠', subType: 'SHIRT', brand: '샘플',
    seasons: ['SPRING'], collections: ['출근'], aiFields: ['BRAND', 'MATERIAL'],
    careLines: ['30도 이하 물세탁', '표백 금지'],
    measurements: [{ part: 'TOTAL_LENGTH', kind: 'LENGTH', valueCm: 73 }],
    materials: [{ part: 'SHELL', fiber: 'COTTON', percent: 60 }, { part: 'SHELL', fiber: 'POLYESTER', percent: 40 }],
  })
  assert.equal(created.status, 201)
  const d = created.body
  const id = d.summary.id
  assert.equal(d.summary.categoryLabel, '상의')
  assert.equal(d.summary.templateLabel, '긴소매 상의')
  assert.ok(JSON.stringify(d.summary.collections).includes('출근'))
  assert.equal(Number(d.summary.totalLengthCm), 73.0)
  assert.equal(d.materials[0].fiberLabel, '면')
  assert.equal(d.careLines[1], '표백 금지')
  const ai = JSON.stringify(d.aiFields)
  assert.ok(ai.includes('BRAND') && ai.includes('MATERIAL'), ai)

  // 사용자가 브랜드를 고치면 그 항목은 AI 값 목록에서 빠지고 소재는 그대로 남는다
  const edited = await c.put(`/api/garments/${id}`, {
    name: '테스트 셔츠', subType: 'SHIRT', brand: '고친 브랜드',
    seasons: ['SPRING'], collections: ['출근'], careLines: ['30도 이하 물세탁', '표백 금지'],
    measurements: [{ part: 'TOTAL_LENGTH', kind: 'LENGTH', valueCm: 73 }],
    materials: [{ part: 'SHELL', fiber: 'COTTON', percent: 60 }, { part: 'SHELL', fiber: 'POLYESTER', percent: 40 }],
  })
  const ai2 = JSON.stringify(edited.body.aiFields)
  assert.ok(ai2.includes('MATERIAL') && !ai2.includes('BRAND'), ai2)
})

test('coverImageProcessingKeepsOriginalAndCanRetry', async () => {
  const c = await login()
  const original = (await c.multipart('/api/images', png(0x1f2a44))).body.id
  const created = (await c.post('/api/garments', { name: '사진 셔츠', subType: 'SHIRT', imageIds: [original] })).body
  const id = created.summary.id
  assert.equal(created.coverImageId, original)
  isJsonNull(created.images[0], 'processing')
  const path = `/api/garments/${id}/images/${original}/processing`

  // 성공: 정리본이 대표가 되고 원본은 그대로 남는다
  const done = (await c.multipart(path, png(0xffffff))).body
  const result = done.coverImageId
  assert.notEqual(result, original)
  assert.equal(done.summary.imageUrl, `/api/images/${result}`)
  assert.equal(imageById(done.images, original).processing, 'DONE')
  const processed = imageById(done.images, result)
  assert.equal(processed.kind, 'PROCESSED')
  assert.equal(processed.processedFromId, original)
  assert.equal((await c.get(`/api/images/${original}`)).status, 200)

  // 다시 처리했는데 실패: 이전 정리본은 지워지고 원본이 대표로 돌아온다
  const failed = (await c.multipart(path, null)).body
  assert.equal(failed.coverImageId, original)
  assert.equal(failed.images.length, 1)
  assert.equal(failed.images[0].processing, 'FAILED')
  assert.equal((await c.get(`/api/images/${result}`)).status, 404)

  // 정리본을 다시 정리하거나 남의 옷 사진을 처리할 수 없다
  const again = (await c.multipart(path, png(0xeeeeee))).body.coverImageId
  assert.equal((await c.multipart(`/api/garments/${id}/images/${again}/processing`, null)).status, 400)
  const other = client()
  await other.post('/api/auth/signup', { email: `img${uniq()}@example.com`, password: 'password123' })
  assert.equal((await other.multipart(path, null)).status, 404)
})

test('placeGarmentsDirectlyAndOnRegister', async () => {
  const c = client()
  await c.post('/api/auth/signup', { email: `place${uniq()}@example.com`, password: 'password123' })
  const closet = (await c.post('/api/spaces', { name: '옷장 A', spaceType: 'HANG' })).body.spaces[0].id
  const map = (await c.post('/api/spaces', { name: '왼쪽 행거', parentId: closet, spaceType: 'HANG', capacity: 1 })).body
  const hanger = find(map.spaces, '왼쪽 행거').id

  // 등록할 때 공간을 고르면 바로 그 위치로 확정된다
  const created = (await c.post('/api/garments', { name: '등록 셔츠', subType: 'SHIRT', spaceId: hanger })).body
  assert.equal(created.summary.locationPath, '옷장 A → 왼쪽 행거')
  assert.equal((await c.post('/api/garments', { name: '바깥 셔츠', subType: 'SHIRT', spaceId: closet })).status, 400)

  // 옷장 지도에서 추천 없이 고른 옷을 바로 넣는다. 용량을 넘기면 초과 수량이 보인다
  const tee = (await c.post('/api/garments', { name: '미배치 티', subType: 'SHORT_SLEEVE_TEE' })).body.summary.id
  assert.ok(JSON.stringify((await c.get('/api/spaces')).body.unplaced).includes('미배치 티'))
  const afterPlace = (await c.post(`/api/spaces/${hanger}/garments`, { garmentIds: [tee] })).body
  assert.equal(afterPlace.unplaced.length, 0)
  const hangerView = find(afterPlace.spaces, '왼쪽 행거')
  assert.equal(hangerView.count, 2)
  assert.equal(hangerView.overBy, 1)
  assert.equal((await c.post(`/api/spaces/${closet}/garments`, { garmentIds: [tee] })).status, 400)
  assert.equal((await c.post(`/api/spaces/${hanger}/garments`, { garmentIds: [] })).status, 400)

  // 세탁 중인 옷은 넣을 수 없다
  await c.post(`/api/garments/${tee}/care`, { careType: 'WASH', place: 'HOME', dueOn: today(1) })
  assert.equal((await c.post(`/api/spaces/${hanger}/garments`, { garmentIds: [tee] })).status, 409)
})

test('userCorrectionsAreKeptBesideWhatTheTagSaid', async () => {
  const { query, run } = srv.db
  const c = client()
  const email = `fix${uniq()}@example.com`
  await c.post('/api/auth/signup', { email, password: 'password123' })
  // AI 키가 없는 테스트 환경이라 '택을 읽은 결과'를 DB에 직접 만든다: 브랜드·사이즈·소재는 읽었고 원산지는 못 읽음
  const [{ id: userId }] = await query('SELECT id FROM users WHERE email = ?', [email])
  await run("INSERT INTO label_extractions (user_id, status_code, raw_text, created_at) VALUES (?, 'DONE', '택', NOW(6))", [userId])
  const [{ ext }] = await query('SELECT MAX(id) AS ext FROM label_extractions WHERE user_id = ?', [userId])
  await run(`INSERT INTO label_extraction_values (extraction_id, field_code, read_value) VALUES (?, 'BRAND', 'OTGYEOL'),
    (?, 'SIZE_LABEL', 'M'), (?, 'MATERIAL', '겉감 면 60%, 겉감 폴리에스터 40%'), (?, 'ORIGIN', NULL)`, [ext, ext, ext, ext])

  // 사이즈를 L로 고치고 못 읽은 원산지를 채운다. 브랜드와 소재(순서만 다름)는 읽은 그대로 둔다
  const created = (await c.post('/api/garments', {
    name: '정정 테스트', subType: 'SHIRT', brand: 'OTGYEOL', sizeLabel: 'L', origin: '베트남',
    materials: [{ part: 'SHELL', fiber: 'POLYESTER', percent: 40 }, { part: 'SHELL', fiber: 'COTTON', percent: 60 }],
    extractionId: ext, aiFields: ['BRAND', 'SIZE_LABEL', 'MATERIAL'],
  })).body
  const values = created.extraction.values
  assert.equal(field(values, 'SIZE_LABEL').readValue, 'M')
  assert.equal(field(values, 'SIZE_LABEL').correctedValue, 'L')
  assert.equal(field(values, 'ORIGIN').correctedValue, '베트남')
  isJsonNull(field(values, 'BRAND'), 'correctedValue')
  isJsonNull(field(values, 'MATERIAL'), 'correctedValue')
  const ai = JSON.stringify(created.aiFields)
  assert.ok(ai.includes('BRAND') && ai.includes('MATERIAL') && !ai.includes('SIZE_LABEL'), ai)

  // 나중에 상세에서 브랜드를 고쳐도 읽은 값 옆에 고친 값이 남는다
  const id = created.summary.id
  const updated = (await c.put(`/api/garments/${id}`, {
    name: '정정 테스트', subType: 'SHIRT', brand: 'OTGYEOL BASIC', sizeLabel: 'L', origin: '베트남',
    materials: [{ part: 'SHELL', fiber: 'COTTON', percent: 60 }, { part: 'SHELL', fiber: 'POLYESTER', percent: 40 }],
  })).body
  assert.equal(field(updated.extraction.values, 'BRAND').correctedValue, 'OTGYEOL BASIC')
  assert.equal(field(updated.extraction.values, 'BRAND').readValue, 'OTGYEOL')
  assert.ok(!JSON.stringify(updated.aiFields).includes('BRAND'))
})

test('moveBatchesToBoxOffsiteAndLaundry', async () => {
  const c = client()
  await c.post('/api/auth/signup', { email: `move${uniq()}@example.com`, password: 'password123' })
  const hanger = (await c.post('/api/spaces', { name: '행거', spaceType: 'HANG' })).body.spaces[0].id
  const names = ['여름 셔츠', '여름 반바지', '플란넬 셔츠', '후드티', '본가 코트']
  const types = ['SHIRT', 'SHORTS', 'SHIRT', 'LONG_SLEEVE_TEE', 'COAT']
  const ids: number[] = []
  for (let i = 0; i < 5; i++) {
    ids.push((await c.post('/api/garments', { name: names[i], subType: types[i], spaceId: hanger })).body.summary.id)
  }
  const label = (await c.multipart('/api/images', png(0xffffff))).body.id

  // 박스 라벨을 찍고 두 벌을 새 박스로 한 번에 옮긴다
  const boxed = await c.post('/api/moves', {
    destination: 'SPACE', newSpace: { name: '박스 A', spaceType: 'BOX' }, garmentIds: [ids[0], ids[1]], imageIds: [label],
  })
  assert.equal(boxed.status, 201)
  assert.equal(boxed.body.spacePath, '박스 A')
  assert.equal(boxed.body.imageUrls.length, 1)
  assert.equal(boxed.body.garments.length, 2)
  const shirt = (await c.get(`/api/garments/${ids[0]}`)).body.summary
  assert.equal(shirt.locationPath, '박스 A')
  assert.equal(shirt.locationKind, 'BOX')
  const inBox = (await c.get(`/api/garments?q=${encodeURIComponent('박스')}`)).body
  assert.equal(inBox.length, 2)
  assert.equal((await c.post('/api/moves', {
    destination: 'SPACE', newSpace: { name: '행거2', spaceType: 'HANG' }, garmentIds: [ids[2]],
  })).status, 400)

  // 집 밖(본가)으로 옮긴 옷은 집 밖으로 보이고, 배치 추천은 집 밖을 고르지 않는다
  const home = find((await c.post('/api/spaces', { name: '본가', spaceType: 'OFFSITE' })).body.spaces, '본가').id
  await c.post('/api/moves', { destination: 'SPACE', spaceId: home, garmentIds: [ids[4]] })
  assert.equal((await c.get(`/api/garments/${ids[4]}`)).body.summary.locationKind, 'OFFSITE')
  await c.post('/api/garments', { name: '새 바지', subType: 'PANTS' })
  const proposals = (await c.post('/api/placements/recommend')).body
  assert.notEqual(find(proposals, '새 바지').spacePath, '본가')

  // 세탁소 영수증 묶음: 두 벌이 세탁 중이 되고 관리함에 회수 예정일과 함께 보인다
  const laundry = await c.post('/api/moves', { destination: 'LAUNDRY', shopName: '동네 세탁소', dueOn: today(2), garmentIds: [ids[2], ids[3]] })
  assert.equal(laundry.status, 201)
  assert.equal(laundry.body.shopName, '동네 세탁소')
  const board = (await c.get('/api/care')).body
  const flannel = find(board.inProgress, '플란넬 셔츠')
  assert.equal(flannel.care.dueOn, today(2))
  assert.equal(flannel.garment.statusLabel, '세탁 중')
  assert.equal(flannel.garment.locationKind, 'CARE')
  assert.ok(find(board.inProgress, '후드티'))

  // 이미 맡긴 옷은 다시 맡기거나 박스로 옮길 수 없다. 날짜 순서가 틀리면 거부한다
  assert.equal((await c.post('/api/moves', { destination: 'LAUNDRY', dueOn: today(2), garmentIds: [ids[2]] })).status, 409)
  // 세탁소 묶음은 회수 예정일이 있어야 관리함에 모인다
  assert.equal((await c.post('/api/moves', { destination: 'LAUNDRY', garmentIds: [ids[0]] })).status, 400)
  assert.equal((await c.post('/api/moves', { destination: 'SPACE', spaceId: home, garmentIds: [ids[3]] })).status, 409)
  assert.equal((await c.post('/api/moves', { destination: 'LAUNDRY', dueOn: today(-1), garmentIds: [ids[0]] })).status, 400)

  const recent = (await c.get('/api/moves')).body
  assert.equal(recent.length, 3)
  assert.equal(recent[0].destination, 'LAUNDRY')

  // 남의 옷은 옮길 수 없다
  assert.equal((await (await login()).post('/api/moves', { destination: 'LAUNDRY', garmentIds: [ids[0]] })).status, 404)
})

test('placementRulesSearchLinkAndConfirmMakesStored', async () => {
  const c = client()
  await c.post('/api/auth/signup', { email: `rules${uniq()}@example.com`, password: 'password123' })
  const closet = (await c.post('/api/spaces', { name: '옷장 B', spaceType: 'HANG' })).body.spaces[0].id
  const map = (await c.post('/api/spaces', { name: '행거', parentId: closet, spaceType: 'HANG', capacity: 5 })).body
  const hanger = find(map.spaces, '행거').id

  // R07: 옷이 들어 있는 공간 안에는 다른 공간을 만들 수 없다(옷이 위치 경로 중간에 끼지 않게)
  const shirt = (await c.post('/api/garments', { name: '규칙 셔츠', subType: 'SHIRT', spaceId: hanger })).body.summary.id
  assert.equal((await c.post('/api/spaces', { name: '칸', parentId: hanger, spaceType: 'FOLD' })).status, 400)

  // R07: 배치 추천의 공간을 바깥 공간(안쪽에 공간이 있는 곳)으로 바꿀 수 없다
  const tee = (await c.post('/api/garments', { name: '추천 티', subType: 'SHORT_SLEEVE_TEE' })).body.summary.id
  const proposals = (await c.post('/api/placements/recommend', { garmentIds: [tee] })).body
  const proposal = proposals[0].id
  assert.equal((await c.put(`/api/placements/${proposal}`, { spaceId: closet })).status, 400)
  assert.equal((await c.put(`/api/placements/${proposal}`, { spaceId: hanger })).status, 200)

  // R08: '착용·보관 전'이던 옷도 회수 후 '재배치 확인'을 누르면 '보관 중'이 된다
  await c.patch(`/api/garments/${shirt}/status`, { status: 'PENDING' })
  const care = (await c.post(`/api/garments/${shirt}/care`, { careType: 'WASH', place: 'HOME', dueOn: today(1) })).body.inProgress[0].care.id
  await c.post(`/api/care/${care}/complete`)
  const confirmed = (await c.post(`/api/garments/${shirt}/confirm-placement`)).body
  assert.equal(confirmed.summary.status, 'STORED')
  assert.equal(confirmed.summary.statusLabel, '보관 중')

  // R02: 택 분석 없이 한 검색도 옷에 남는다(결과가 없어도 '검색 결과 없음'으로 상세에 보인다)
  const searchId = await insertSearch(c)
  const linked = (await c.post('/api/garments', { name: '검색만 한 셔츠', subType: 'SHIRT', searchId })).body
  assert.equal(linked.search.id, searchId)
  assert.equal(linked.search.candidates.length, 0)
  assert.equal((await (await login()).post('/api/garments', { name: '남의 검색', subType: 'SHIRT', searchId })).status, 404)
})

/** 서울 날짜 d의 hh:mm을 UTC 'YYYY-MM-DD HH:MM:SS'로. */
function seoulToUtc(date: string, hh: number, mm: number) {
  const d = new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+09:00`)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

test('careCompletedCheckUsesSeoulDate', async () => {
  // completed_at은 UTC로, dropped_on은 서울 날짜로 저장된다. 실행 시각과 관계없이 서울 00:30 회수를 확인한다.
  const { run } = srv.db
  const c = client()
  await c.post('/api/auth/signup', { email: `kst${uniq()}@example.com`, password: 'password123' })
  const shirt = (await c.post('/api/garments', { name: '새벽 회수 셔츠', subType: 'SHIRT' })).body.summary.id
  const care = (await c.post(`/api/garments/${shirt}/care`, { careType: 'WASH', place: 'HOME', dueOn: today(1) })).body.inProgress[0].care.id
  const earlyToday = seoulToUtc(today(0), 0, 30)
  const lateYesterday = seoulToUtc(today(-1), 23, 30)

  // 맡긴 날 서울 23:30(전날)에 회수했다는 기록은 막힌다
  await assert.rejects(run('UPDATE care_events SET completed_at = ? WHERE id = ?', [lateYesterday, care]), (e: any) => {
    assert.match(String(e.message), /ck_ce_completed/)
    return true
  })
  // 맡긴 날 서울 00:30 회수(UTC로는 전날 15:30)는 된다
  assert.equal((await run('UPDATE care_events SET completed_at = ? WHERE id = ?', [earlyToday, care])).affectedRows, 1)
})

/** AI 없이 검색 기록 한 건을 만든다(결과 없음). 로그인한 사용자의 것. */
async function insertSearch(c: Client): Promise<number> {
  const { query, run } = srv.db
  const userId = (await c.get('/api/auth/me')).body.id
  await run("INSERT INTO product_searches (user_id, query_brand, query_product_code, status_code, searched_at) VALUES (?, '테스트', NULL, 'SUCCEEDED', NOW(6))", [userId])
  const [{ id }] = await query('SELECT MAX(id) AS id FROM product_searches WHERE user_id = ?', [userId])
  return id
}

test('seededClosetFlowsShareOneGarmentId', async () => {
  const c = await login()

  const list = (await c.get('/api/garments')).body
  assert.ok(list.length >= 7)
  const denim = find(list, '연청 데님 팬츠')
  isJsonNull(denim, 'locationPath')
  assert.equal(find(list, '베이지 니트').statusLabel, '세탁 중')
  isJsonNull(find(list, '베이지 니트'), 'locationPath')
  assert.equal(find(list, '네이비 옥스퍼드 셔츠').locationPath, '옷장 A → 왼쪽 행거')

  // 분류 수정: 계절 추가가 저장되고 다시 읽어도 유지된다
  const teeId = find(list, '화이트 반소매 티셔츠').id
  assert.equal((await c.put(`/api/garments/${teeId}`, {
    name: '화이트 반소매 티셔츠', colorName: '화이트', colorHex: '#f4f4ef', subType: 'SHORT_SLEEVE_TEE',
    seasons: ['SUMMER', 'SPRING'], materials: [{ part: 'SHELL', fiber: 'COTTON', percent: 100 }],
  })).status, 200)
  const seasons = JSON.stringify((await c.get(`/api/garments/${teeId}`)).body.summary.seasons)
  assert.ok(seasons.includes('SPRING') && seasons.includes('SUMMER'), seasons)
  assert.equal((await c.put(`/api/garments/${teeId}`, { name: ' ', subType: 'SHORT_SLEEVE_TEE' })).status, 400)

  // 공간 추가 → 배치 추천은 미확정 → 배치 완료 후 위치 검색
  assert.equal((await c.post('/api/spaces', { name: '현관 행거', spaceType: 'HANG', capacity: 3 })).status, 201)
  assert.equal((await c.post('/api/spaces', { name: '', spaceType: 'HANG', capacity: 0 })).status, 400)
  const proposals = (await c.post('/api/placements/recommend')).body
  const denimProposal = find(proposals, '연청 데님 팬츠')
  assert.equal(denimProposal.spacePath, '서랍장 → 2단')
  const denimId = denimProposal.garment.id
  isJsonNull((await c.get(`/api/garments/${denimId}`)).body.summary, 'locationPath')
  await c.post(`/api/placements/${denimProposal.id}/apply`)
  const search = (await c.get(`/api/garments?q=${encodeURIComponent('연청')}`)).body
  assert.equal(search.length, 1)
  assert.equal(search[0].locationPath, '서랍장 → 2단')
  assert.ok(!(await c.get('/api/placements')).raw.includes('연청 데님 팬츠'))

  // 관리함: 기한 지남 → 회수 완료 → 위치 미확인 → 재배치 확인
  const board = (await c.get('/api/care')).body
  const overdue = find(board.overdue, '베이지 니트')
  assert.ok(find(board.dueToday, '카키 치노 팬츠'))
  const knitId = overdue.garment.id
  assert.equal(overdue.garment.usable, false)
  assert.equal((await c.patch(`/api/garments/${knitId}/status`, { status: 'STORED' })).status, 409)
  const afterComplete = (await c.post(`/api/care/${overdue.care.id}/complete`)).body
  assert.ok(!JSON.stringify(afterComplete.overdue).includes('베이지 니트'))
  const knit = (await c.get(`/api/garments/${knitId}`)).body
  assert.equal(knit.summary.status, 'RETURNED_UNPLACED')
  isJsonNull(knit.summary, 'locationPath')
  assert.equal(knit.suggestedLocationPath, '서랍장 → 2단')
  assert.notEqual(knit.careHistory[0].completedAt ?? null, null)
  const confirmed = (await c.post(`/api/garments/${knitId}/confirm-placement`)).body
  assert.equal(confirmed.summary.status, 'STORED')
  assert.equal(confirmed.summary.locationPath, '서랍장 → 2단')

  // 세탁 맡기기: 예정일이 맡긴 날보다 앞서면 거부, 맡기면 세탁 중이 되고 진행 중 목록에 보인다
  const shirtId = find(list, '네이비 옥스퍼드 셔츠').id
  assert.equal((await c.post(`/api/garments/${shirtId}/care`, { careType: 'WASH', place: 'SHOP', shopName: '동네 세탁소', dueOn: today(-1) })).status, 400)
  assert.equal((await c.post(`/api/garments/${shirtId}/care`, { careType: 'WASH', place: 'HOME', shopName: '동네 세탁소', dueOn: today(1) })).status, 400)
  const careBoard = (await c.post(`/api/garments/${shirtId}/care`, { careType: 'WASH', place: 'SHOP', shopName: '동네 세탁소', dueOn: today(1) })).body
  const shirtCare = find(careBoard.inProgress, '네이비 옥스퍼드 셔츠')
  assert.equal(shirtCare.garment.statusLabel, '세탁 중')
  assert.equal(shirtCare.care.dueOn, today(1))
  assert.equal((await c.post(`/api/garments/${shirtId}/care`, { careType: 'REPAIR', place: 'HOME', dueOn: today(1) })).status, 409)
  // 옷장 지도에서도 세탁 중인 셔츠는 행거에 없는 것으로 보인다(같은 상태를 모든 화면이 공유)
  const mapView = await c.get('/api/spaces')
  assert.ok(!JSON.stringify(mapView.body).includes('"name":"네이비 옥스퍼드 셔츠"'))
})
