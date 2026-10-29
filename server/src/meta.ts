import { Router } from 'express'
import { query } from './db.js'
import { currentSeason, today } from './dates.js'
import { handle } from './http.js'

// MetaController(Spring): 화면이 쓰는 선택지와 한국어 이름. DB의 도메인 테이블을 그대로 읽는다.

/** 도메인 테이블 이름과 정렬 순서. 화면에 보여 줄 순서가 정해진 테이블은 sort_order를 쓴다. */
const TABLES: [string, string][] = [
  ['categories', "FIELD(code, 'TOP', 'OUTER', 'BOTTOM', 'DRESS', 'ETC')"],
  ['clothing_templates', 'code'],
  ['seasons', 'sort_order'],
  ['garment_statuses', "FIELD(code, 'STORED', 'PENDING', 'WASH_WAITING', 'WASHING', 'REPAIRING', 'RETURNED_UNPLACED')"],
  ['wear_frequencies', 'sort_order'],
  ['space_types', "FIELD(code, 'HANG', 'FOLD', 'LONG_TERM', 'BOX', 'OFFSITE')"],
  ['care_types', 'code DESC'],
  ['care_places', 'code'],
  ['material_parts', "FIELD(code, 'SHELL', 'LINING', 'TRIM', 'FILL')"],
  ['fibers', "FIELD(code, 'OTHER'), label"],
  ['measurement_parts', 'code'],
  ['measurement_kinds', 'code'],
]

const camel = (snake: string) => snake.replace(/_(.)/g, (_m, c: string) => c.toUpperCase())

export const metaRouter = Router()

metaRouter.get('/meta', handle(async () => {
  const meta: Record<string, unknown> = {}
  // 테이블 이름과 정렬식은 위의 고정 목록에서만 온다(사용자 입력 아님).
  const options = await Promise.all(TABLES.map(([table, order]) => query(`SELECT code, label FROM ${table} ORDER BY ${order}`)))
  TABLES.forEach(([table], i) => {
    meta[camel(table)] = options[i].map((r) => ({ value: r.code, label: r.label }))
  })
  meta.subTypes = (await query(`SELECT st.code, st.label, st.category_code, stt.template_code
    FROM sub_types st LEFT JOIN sub_type_templates stt ON stt.sub_type_code = st.code
    ORDER BY st.sort_order`)).map((r) => ({ value: r.code, label: r.label, category: r.category_code, template: r.template_code }))
  meta.currentSeason = currentSeason()
  meta.today = today()
  return meta
}))
