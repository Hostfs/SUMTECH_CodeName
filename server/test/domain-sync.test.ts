// DomainSyncTest 이식: 코드의 도메인 값(src/domain.ts)과 DB 도메인 테이블의 코드·이름·관계가 같은지 교차 확인한다.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { freshDatabase, type Db } from './helpers.js'

let db: Db
let domain: typeof import('../src/domain.js')

before(async () => {
  db = await freshDatabase({ seed: false })
  domain = await import('../src/domain.js')
})

after(async () => {
  await db?.pool.end()
})

type Ordered = { keys: readonly string[]; label: (k: any) => string }

async function pairs(sql: string): Promise<Record<string, string | null>> {
  const rows = await db.query(sql)
  const out: Record<string, string | null> = {}
  for (const r of rows) {
    const [k, v] = Object.values(r)
    out[String(k)] = v == null ? null : String(v)
  }
  return out
}

const table = (name: string) => pairs(`SELECT code, label FROM ${name}`)
const labels = (d: Ordered) => Object.fromEntries(d.keys.map((k) => [k, d.label(k)]))

test('enumsMatchDomainTables', async () => {
  const d = domain
  const cases: [string, Ordered][] = [
    ['categories', d.Category],
    ['clothing_templates', d.ClothingTemplate],
    ['sub_types', d.SubType],
    ['seasons', d.Season],
    ['garment_statuses', d.GarmentStatus],
    ['wear_frequencies', d.WearFrequency],
    ['space_types', d.SpaceType],
    ['care_types', d.CareType],
    ['care_places', d.CarePlace],
    ['garment_fields', d.GarmentField],
    ['material_parts', d.MaterialPart],
    ['fibers', d.Fiber],
    ['measurement_parts', d.MeasurementPart],
    ['measurement_kinds', d.MeasurementKind],
  ]
  for (const [name, values] of cases) {
    assert.deepEqual(await table(name), labels(values), name)
  }
})

test('relationsMatchDomainTables', async () => {
  const { SubType, CareType, GarmentStatus } = domain

  assert.deepEqual(await pairs('SELECT code, category_code FROM sub_types'),
    Object.fromEntries(SubType.keys.map((s) => [s, SubType.category(s)])))

  assert.deepEqual(await pairs('SELECT sub_type_code, template_code FROM sub_type_templates'),
    Object.fromEntries(SubType.keys.filter((s) => SubType.template(s) != null).map((s) => [s, SubType.template(s)])))

  // Java는 ClothingTemplate.category와 비교한다. domain.ts의 템플릿에는 종류가 없으므로,
  // 템플릿을 쓰는 세부 종류의 종류가 템플릿의 종류(clothing_templates.category_code)와 같은지로 대신 확인한다.
  const templateCategory = await pairs('SELECT code, category_code FROM clothing_templates')
  for (const s of SubType.keys) {
    const t = SubType.template(s)
    if (t) assert.equal(SubType.category(s), templateCategory[t], `${s} → ${t}`)
  }
  assert.deepEqual(Object.keys(templateCategory).sort(), [...domain.ClothingTemplate.keys].sort())

  const careStatus = await pairs('SELECT code, garment_status_code FROM care_types')
  assert.deepEqual(careStatus, Object.fromEntries(CareType.keys.map((t) => [t, CareType.garmentStatus(t)])))
  // 집에 없는 상태 = care_types에 나오는 상태
  assert.deepEqual(GarmentStatus.keys.filter((s) => GarmentStatus.isAway(s)).sort(), Object.values(careStatus).sort())
})

// Java 테스트에는 없는 추가 확인: domain.ts가 '배열 순서가 Java enum 순서(정렬 기준)'라고 하므로 sort_order가 있는 표와 순서도 같아야 한다.
test('orderMatchesSortOrderColumns', async () => {
  const d = domain
  for (const [name, values] of [['sub_types', d.SubType], ['seasons', d.Season], ['wear_frequencies', d.WearFrequency]] as [string, Ordered][]) {
    const rows = await db.query(`SELECT code FROM ${name} ORDER BY sort_order`)
    assert.deepEqual(rows.map((r) => r.code), [...values.keys], name)
  }
})
