// 테스트 공통 준비(Spring 테스트의 application.properties·CleanDatabaseConfig·Client에 해당).
// 서버 모듈은 환경변수를 import 시점에 읽으므로, 여기서 환경을 먼저 맞춘 뒤 동적 import로 불러온다.
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { deflateSync } from 'node:zlib'

const env = process.env
// CI와 같은 이름(TEST_DATABASE_*)을 서버가 읽는 DATABASE_*로 옮긴다.
// 기본값은 로컬 일회용 MariaDB(3399)의 테스트 전용 DB. 테스트는 시작할 때 이 DB의 표를 모두 지운다.
env.DATABASE_URL = env.TEST_DATABASE_URL || 'jdbc:mariadb://127.0.0.1:3399/otgyeol_ntest'
env.DATABASE_USERNAME = env.TEST_DATABASE_USERNAME ?? 'root'
env.DATABASE_PASSWORD = env.TEST_DATABASE_PASSWORD ?? ''
env.SEED_USER_EMAIL = 'student@example.com'
env.SEED_USER_PASSWORD = 'loopthon-2026'
env.RELEASE_ID = 'test-release'
// AI·기상청 호출은 늘 실패하게 둔다(키 없음 → 정해진 대체 응답).
env.AI_GATEWAY_API_KEY = ''
env.KMA_API_KEY = ''

export const SEED_EMAIL = 'student@example.com'
export const SEED_PASSWORD = 'loopthon-2026'

export type Db = typeof import('../src/db.js')

/** 테스트 DB의 표·뷰·트리거·루틴을 모두 지운다(Flyway clean과 같은 결과). */
export async function cleanDatabase(db: Db) {
  const conn = await db.pool.getConnection()
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0')
    const [triggers] = await conn.query<any[]>('SELECT trigger_name AS name FROM information_schema.triggers WHERE trigger_schema = DATABASE()')
    for (const t of triggers) await conn.query(`DROP TRIGGER IF EXISTS \`${t.name}\``)
    const [tables] = await conn.query<any[]>('SELECT table_name AS name, table_type AS type FROM information_schema.tables WHERE table_schema = DATABASE()')
    for (const t of tables) {
      await conn.query(`${t.type === 'VIEW' ? 'DROP VIEW' : 'DROP TABLE'} IF EXISTS \`${t.name}\``)
    }
    const [routines] = await conn.query<any[]>('SELECT routine_name AS name, routine_type AS type FROM information_schema.routines WHERE routine_schema = DATABASE()')
    for (const r of routines) await conn.query(`DROP ${r.type} IF EXISTS \`${r.name}\``)
    await conn.query('SET FOREIGN_KEY_CHECKS = 1')
  } finally {
    conn.release()
  }
}

/** 빈 DB → 마이그레이션 → (선택) 시드. DB 모듈을 돌려준다. */
export async function freshDatabase({ seed = true } = {}): Promise<Db> {
  const db = await import('../src/db.js')
  await cleanDatabase(db)
  const { migrate } = await import('../src/migrate.js')
  await migrate()
  if (seed) {
    const { seedOnStartup } = await import('../src/seed.js')
    await seedOnStartup()
  }
  return db
}

export interface TestServer {
  base: string
  db: Db
  close(): Promise<void>
}

/** 빈 DB에서 앱을 임의 포트로 띄운다(@SpringBootTest RANDOM_PORT + CleanDatabaseConfig). */
export async function startServer(): Promise<TestServer> {
  const db = await freshDatabase()
  const { createApp } = await import('../src/app.js')
  const server: Server = await new Promise((resolve) => {
    const s = createApp().listen(0, '127.0.0.1', () => resolve(s))
  })
  const { port } = server.address() as AddressInfo
  return {
    base: `http://127.0.0.1:${port}`,
    db,
    async close() {
      server.closeAllConnections?.()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await db.pool.end()
    },
  }
}

export interface Res {
  status: number
  body: any
  raw: string
}

/** 쿠키를 기억하는 작은 HTTP 클라이언트(Java 테스트의 Client와 같다). */
export class Client {
  private cookies = new Map<string, string>()

  constructor(private base: string) {}

  private cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  private remember(r: Response) {
    for (const c of r.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';')
      const i = pair.indexOf('=')
      const name = pair.slice(0, i).trim()
      const value = pair.slice(i + 1).trim()
      const expired = attrs.some((a) => {
        const [k, v] = a.trim().split('=')
        return (k.toLowerCase() === 'max-age' && Number(v) <= 0) || (k.toLowerCase() === 'expires' && new Date(v).getTime() < Date.now())
      })
      if (expired || value === '') this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }

  private async finish(r: Response): Promise<Res> {
    this.remember(r)
    const raw = await r.text()
    const t = raw.trim()
    return { status: r.status, body: t.startsWith('{') || t.startsWith('[') ? JSON.parse(t) : null, raw }
  }

  /** body가 문자열이 아니면 JSON으로 바꿔 보낸다. null/undefined면 본문 없이 보낸다. */
  async send(method: string, path: string, body?: unknown): Promise<Res> {
    const headers: Record<string, string> = {}
    const cookie = this.cookieHeader()
    if (cookie) headers.Cookie = cookie
    let payload: string | undefined
    if (body != null) {
      headers['Content-Type'] = 'application/json'
      payload = typeof body === 'string' ? body : JSON.stringify(body)
    }
    return this.finish(await fetch(this.base + path, { method, headers, body: payload, redirect: 'manual' }))
  }

  get(path: string) {
    return this.send('GET', path)
  }

  post(path: string, body?: unknown) {
    return this.send('POST', path, body)
  }

  put(path: string, body?: unknown) {
    return this.send('PUT', path, body)
  }

  patch(path: string, body?: unknown) {
    return this.send('PATCH', path, body)
  }

  /** multipart 요청. form을 그대로 보낸다. */
  async form(path: string, form: FormData): Promise<Res> {
    const headers: Record<string, string> = {}
    const cookie = this.cookieHeader()
    if (cookie) headers.Cookie = cookie
    return this.finish(await fetch(this.base + path, { method: 'POST', headers, body: form, redirect: 'manual' }))
  }

  /** Java Client.multipart: png가 있으면 file 칸에 a.png, 없으면 text 칸 failed=1 하나만 보낸다. */
  multipart(path: string, png: Uint8Array | null) {
    const f = new FormData()
    if (png) f.append('file', new Blob([png], { type: 'image/png' }), 'a.png')
    else f.append('failed', '1')
    return this.form(path, f)
  }

  async login(): Promise<this> {
    const r = await this.post('/api/auth/login', { email: SEED_EMAIL, password: SEED_PASSWORD })
    if (r.status !== 200) throw new Error(`seed login failed: ${r.status} ${r.raw}`)
    return this
  }
}

// ---------- PNG ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

/** 한 색으로 채운 8x8 RGB PNG(Java 테스트의 png(rgb)). */
export function png(rgb: number, size = 8): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  const row = Buffer.alloc(1 + size * 3)
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = (rgb >> 16) & 0xff
    row[2 + x * 3] = (rgb >> 8) & 0xff
    row[3 + x * 3] = rgb & 0xff
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 1x1 PNG(AiFallbackTests의 PNG 상수). */
export const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

// ---------- 날짜·검색 ----------

const seoulDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })

/** 서울 기준 오늘 + n일('YYYY-MM-DD'). */
export function today(plusDays = 0): string {
  const d = new Date(`${seoulDate.format(new Date())}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + plusDays)
  return d.toISOString().slice(0, 10)
}

/** 목록에서 이름으로 찾는다(summary·garment 안의 name도 본다). */
export function find(array: any[], name: string): any {
  for (const n of array) {
    const target = n.summary ?? n.garment ?? n
    if (target?.name === name) return n
  }
  throw new Error(`${name} not found in ${JSON.stringify(array)}`)
}

export function field(values: any[], code: string): any {
  const v = values.find((x) => x.field === code)
  if (!v) throw new Error(`${code} not found in ${JSON.stringify(values)}`)
  return v
}

export function imageById(images: any[], imageId: number): any {
  const v = images.find((x) => Number(x.id) === imageId)
  if (!v) throw new Error(`${imageId} not found in ${JSON.stringify(images)}`)
  return v
}

export const uniq = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`
