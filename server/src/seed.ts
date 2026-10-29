import { hashPassword } from './auth.js'
import { config } from './config.js'
import { insertCare, newGarment, saveGarment, type Garment } from './core.js'
import { one, run, tx } from './db.js'
import { plusDays, today } from './dates.js'
import type { Fiber, MaterialPart, Season, SpaceType, SubType, WearFrequency } from './domain.js'

/**
 * 첫 기동 때 시드 계정('사용자' 역할)과 흐름 S2~S8에 필요한 선행 데이터를 만든다(옷 11벌, 공간 8곳, 세탁·수선 2건).
 * SEED_USER_EMAIL이 비어 있으면(배포 환경) 아무것도 만들지 않는다. 이미 계정이 있으면 건너뛴다(seed/SeedRunner.java).
 */
export async function seedOnStartup(): Promise<void> {
  const email = config.seedEmail
  const password = config.seedPassword
  if (email.trim() === '' || password.trim() === '') return
  const normalized = email.trim().toLowerCase()
  await tx(async () => {
    if (await one('SELECT id FROM users WHERE email = ?', [normalized])) return
    const r = await run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', [normalized, await hashPassword(password), new Date()])
    await populateSeedData(r.insertId)
    console.log(`시드 계정과 예시 옷장을 만들었습니다: ${normalized}`)
  })
}

/** 시드 계정으로 다시 로그인할 때 이전 흐름에서 바뀐 시드 데이터를 초기 상태로 되돌린다. */
export async function resetIfSeedUser(userId: number, email: string): Promise<void> {
  const seed = config.seedEmail
  if (seed.trim() === '' || email == null || email.toLowerCase() !== seed.trim().toLowerCase()) return
  await tx(async () => {
    await run('DELETE FROM outfit_looks WHERE user_id = ?', [userId])
    await run('DELETE FROM move_batches WHERE user_id = ?', [userId])
    await run('DELETE FROM product_searches WHERE user_id = ?', [userId])
    await run('DELETE FROM label_extractions WHERE user_id = ?', [userId])
    await run('DELETE FROM garments WHERE user_id = ?', [userId])
    await run('DELETE FROM collections WHERE user_id = ?', [userId])
    await run('DELETE FROM images WHERE user_id = ?', [userId])
    await run('DELETE FROM storage_spaces WHERE user_id = ?', [userId])
    await populateSeedData(userId)
  })
}

type M = [MaterialPart, Fiber, number]

async function space(userId: number, parentId: number | null, name: string, type: SpaceType, capacity: number | null): Promise<number> {
  const r = await run('INSERT INTO storage_spaces (user_id, name, space_type_code, capacity, created_at) VALUES (?, ?, ?, ?, ?)',
    [userId, name, type, capacity, new Date()])
  if (parentId != null) {
    await run('INSERT INTO storage_space_parents (space_id, parent_space_id) VALUES (?, ?)', [r.insertId, parentId])
  }
  return r.insertId
}

async function garment(userId: number, name: string, color: string, hex: string, subType: SubType, seasons: Season[],
  materials: M[], totalLengthCm: number, frequency: WearFrequency): Promise<Garment> {
  const g = newGarment(userId)
  g.name = name
  g.colorName = color
  g.colorHex = hex
  g.subType = subType
  g.seasons = [...seasons]
  g.materials = materials.map(([part, fiber, percent]) => ({ part, fiber, percent }))
  g.measurements = [{ part: 'TOTAL_LENGTH', kind: 'LENGTH', valueCm: totalLengthCm, source: '직접 측정', confirmed: true }]
  g.wearFrequency = frequency
  return saveGarment(g)
}

async function place(g: Garment, spaceId: number, at: Date) {
  await run('INSERT INTO garment_placements (garment_id, space_id, placed_at) VALUES (?, ?, ?)', [g.id, spaceId, at])
}

async function care(garmentId: number, careType: 'WASH' | 'REPAIR', shop: string, description: string, dropped: string, due: string) {
  await insertCare({ garmentId, careType, place: 'SHOP', shopName: shop, description, droppedOn: dropped, dueOn: due })
}

async function populateSeedData(userId: number) {
  const closet = await space(userId, null, '옷장 A', 'HANG', null)
  const leftHanger = await space(userId, closet, '왼쪽 행거', 'HANG', 8)
  const drawer = await space(userId, null, '서랍장', 'FOLD', null)
  const secondDrawer = await space(userId, drawer, '2단', 'FOLD', 4)
  const underBed = await space(userId, null, '침대 아래', 'LONG_TERM', null)
  await space(userId, underBed, '겨울 박스', 'LONG_TERM', 10)
  // 옮기는 단위 묶음 기록(R11)의 목적지: 라벨을 붙인 박스와 집 밖(본가).
  await space(userId, null, '여름 박스', 'BOX', 12)
  await space(userId, null, '본가', 'OFFSITE', null)

  // 위치를 정한 지 일주일 된 옷장. 세탁·수선 중인 옷도 원래 자리는 남아 있어 회수 후 그 자리를 제안한다.
  const placedAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const shirt = await garment(userId, '네이비 옥스퍼드 셔츠', '네이비', '#1f2a44', 'SHIRT',
    ['SPRING', 'AUTUMN'], [['SHELL', 'COTTON', 100]], 74, 'HIGH')
  const tee = await garment(userId, '화이트 반소매 티셔츠', '화이트', '#f4f4ef', 'SHORT_SLEEVE_TEE',
    ['SUMMER'], [['SHELL', 'COTTON', 100]], 68, 'HIGH')
  const jacket = await garment(userId, '그레이 울 재킷', '그레이', '#6b6e70', 'JACKET',
    ['AUTUMN', 'WINTER'], [['SHELL', 'WOOL', 70], ['SHELL', 'POLYESTER', 30], ['LINING', 'POLYESTER', 100]], 72, 'MEDIUM')
  const slacks = await garment(userId, '블랙 슬랙스', '블랙', '#1b1b1d', 'PANTS',
    ['SPRING', 'AUTUMN', 'WINTER'], [['SHELL', 'POLYESTER', 68], ['SHELL', 'RAYON', 28], ['SHELL', 'POLYURETHANE', 4]], 100, 'HIGH')
  await garment(userId, '연청 데님 팬츠', '연청', '#8fb3d9', 'JEANS', ['SPRING', 'AUTUMN'],
    [['SHELL', 'COTTON', 98], ['SHELL', 'POLYURETHANE', 2]], 102, 'MEDIUM')
  const knit = await garment(userId, '베이지 니트', '베이지', '#d9c8a9', 'KNIT', ['AUTUMN', 'WINTER'],
    [['SHELL', 'WOOL', 50], ['SHELL', 'ACRYLIC', 50]], 66, 'MEDIUM')
  const chino = await garment(userId, '카키 치노 팬츠', '카키', '#8a8160', 'PANTS', ['SPRING', 'AUTUMN'],
    [['SHELL', 'COTTON', 100]], 101, 'LOW')

  await place(shirt, leftHanger, placedAt)
  await place(jacket, leftHanger, placedAt)
  await place(tee, secondDrawer, placedAt)
  await place(slacks, secondDrawer, placedAt)
  await place(knit, secondDrawer, placedAt)
  await place(chino, secondDrawer, placedAt)
  // 연청 데님 팬츠는 미배치로 둔다(S6).

  // 묶음 기록 흐름용: 여름 옷 두 벌은 박스로(S4), 셔츠·후드 두 벌은 세탁소로(S5) 한 번에 옮긴다.
  const linen = await garment(userId, '린넨 반소매 셔츠', '아이보리', '#efe8d8', 'SHIRT', ['SUMMER'],
    [['SHELL', 'LINEN', 100]], 70, 'LOW')
  const shorts = await garment(userId, '네이비 반바지', '네이비', '#1f2a44', 'SHORTS', ['SUMMER'],
    [['SHELL', 'COTTON', 100]], 48, 'LOW')
  const flannel = await garment(userId, '체크 플란넬 셔츠', '레드', '#9e3b37', 'SHIRT', ['AUTUMN', 'WINTER'],
    [['SHELL', 'COTTON', 100]], 76, 'MEDIUM')
  const hoodie = await garment(userId, '그레이 후드티', '그레이', '#8e8f93', 'LONG_SLEEVE_TEE',
    ['SPRING', 'AUTUMN'], [['SHELL', 'COTTON', 80], ['SHELL', 'POLYESTER', 20]], 68, 'HIGH')
  // 2단 서랍(수용 4벌)을 채우면 S6의 배치 추천이 달라지므로 여유 있는 왼쪽 행거에 둔다.
  await place(linen, leftHanger, placedAt)
  await place(shorts, leftHanger, placedAt)
  await place(flannel, leftHanger, placedAt)
  await place(hoodie, leftHanger, placedAt)

  const t = today()
  await care(knit.id, 'WASH', '한빛 세탁소', '드라이클리닝', plusDays(t, -4), plusDays(t, -1))
  await care(chino.id, 'REPAIR', '미싱 수선실', '밑단 3cm 줄임', plusDays(t, -2), t)
}
