// LocationKindRulesTest·WeatherRulesTest 이식. DB·외부 호출 없이 도는 순수 계산.
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import './helpers.js'

after(async () => {
  // core.ts·weather.ts가 db.ts를 불러 풀을 만들었을 수 있다(연결은 열지 않았지만 정리해 둔다).
  const { pool } = await import('../src/db.js')
  await pool.end()
})

test('박스와_집_밖_아래_공간은_그_유형을_따른다', async () => {
  const { awayAware } = await import('../src/core.js')
  // 1 본가(집 밖) → 2 안방 옷장(걸기) → 3 위 칸(접기), 4 여름 박스 → 5 칸막이(접기), 6 옷장 A(걸기) → 7 왼쪽 행거(걸기)
  const own = new Map([[1, 'OFFSITE'], [2, 'HANG'], [3, 'FOLD'], [4, 'BOX'], [5, 'FOLD'], [6, 'HANG'], [7, 'HANG']] as const)
  const parentOf = new Map([[2, 1], [3, 2], [5, 4], [7, 6]])

  const types = awayAware(new Map(own), parentOf)

  assert.equal(types.get(2), 'OFFSITE')
  assert.equal(types.get(3), 'OFFSITE')
  assert.equal(types.get(5), 'BOX')
  assert.equal(types.get(7), 'HANG')
})

/** {nx, ny} 또는 {x, y} 또는 [x, y] 무엇으로 돌려줘도 [x, y]로 맞춘다. */
function point(p: any): [number, number] {
  if (Array.isArray(p)) return [p[0], p[1]]
  if ('nx' in p) return [p.nx, p.ny]
  return [p.x, p.y]
}

test('위경도를_기상청_격자로_바꾼다', async () => {
  const { kmaGrid } = (await import('../src/weather.js')) as any
  assert.equal(typeof kmaGrid, 'function', 'weather.ts should export kmaGrid(lat, lon) (KmaGrid.of)')
  assert.deepEqual(point(kmaGrid(37.5665, 126.978)), [60, 127]) // 서울시청
  assert.deepEqual(point(kmaGrid(35.1796, 129.0756)), [98, 76]) // 부산시청
  assert.deepEqual(point(kmaGrid(33.4996, 126.5312)), [53, 38]) // 제주시
})

test('기온에_맞는_계절을_고른다', async () => {
  const { seasonsFor } = (await import('../src/weather.js')) as any
  assert.equal(typeof seasonsFor, 'function', 'weather.ts should export seasonsFor(t) (WeatherController.seasonsFor)')
  assert.deepEqual(seasonsFor(27.0), ['SUMMER'])
  assert.deepEqual(seasonsFor(18.0), ['SPRING', 'AUTUMN'])
  assert.deepEqual(seasonsFor(8.0), ['AUTUMN', 'WINTER'])
  assert.deepEqual(seasonsFor(-3.0), ['WINTER'])
})
