import { Router } from 'express'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { one, run } from './db.js'
import { ApiError, handle, idParam, upload } from './http.js'
import { currentUser } from './session.js'

/** 사진 업로드와 조회. 본인 사진만 볼 수 있다. 업로드한 사진은 옷을 저장할 때 그 옷에 연결된다. */
export const imagesRouter = Router()

export const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const MAX_BYTES = 10 * 1024 * 1024

export const imageUrlOf = (id: number | null | undefined) => (id == null ? null : `/api/images/${id}`)

/** 검사를 통과한 사진을 images에 저장하고 ID를 돌려준다(ImageController.store). */
export async function storeImage(userId: number, data: Buffer, contentType: string, sourceUrl: string | null): Promise<number> {
  if (!data || data.length === 0) {
    throw ApiError.badRequest('사진 파일이 비어 있어요.')
  }
  if (!ALLOWED_TYPES.has(contentType)) {
    throw ApiError.badRequest('JPG, PNG, WEBP 사진만 올릴 수 있어요.')
  }
  if (data.length > MAX_BYTES) {
    throw ApiError.badRequest('사진은 한 장에 10MB까지 올릴 수 있어요.')
  }
  const r = await run('INSERT INTO images (user_id, content_type, data, source_url, created_at) VALUES (?, ?, ?, ?, ?)',
    [userId, contentType, data, sourceUrl, new Date()])
  return r.insertId
}

imagesRouter.post('/images', upload.single('file'), handle(async (req) => {
  const userId = currentUser(req)
  const file = req.file
  if (!file) throw ApiError.badRequest('사진 파일이 비어 있어요.')
  const id = await storeImage(userId, file.buffer, file.mimetype, null)
  return { id, url: imageUrlOf(id) }
}, 201))

imagesRouter.get('/images/:id', handle(async (req, res) => {
  const userId = currentUser(req)
  const id = idParam(req)
  const asset = await one('SELECT content_type, data FROM images WHERE id = ? AND user_id = ?', [id, userId])
  if (!asset) throw ApiError.notFound('사진')
  const data: Buffer = asset.data
  // Spring: CacheControl.noCache().cachePrivate(). ETag는 붙이지 않는다(res.send 대신 res.end).
  res.status(200)
  res.setHeader('Content-Type', asset.content_type)
  res.setHeader('Cache-Control', 'no-cache, private')
  res.setHeader('Content-Length', String(data.length))
  res.end(data)
}))

// ---------- 외부 주소 검사(ProductSearchController.isPublicHttp) ----------

function ipv4Blocked(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  return a === 127 // loopback
    || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) // site-local
    || (a === 169 && b === 254) // link-local
    || ip === '0.0.0.0' // any-local
    || (a >= 224 && a <= 239) // multicast
}

function ipv6Blocked(ip: string): boolean {
  const lower = ip.toLowerCase()
  // IPv4 대응 주소(::ffff:a.b.c.d)는 Java처럼 IPv4로 보고 검사한다.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
  if (mapped) return ipv4Blocked(mapped[1])
  if (lower === '::1' || lower === '::') return true
  const first = parseInt(lower.split(':')[0] || '0', 16)
  return (first & 0xffc0) === 0xfe80 // link-local fe80::/10
    || (first & 0xffc0) === 0xfec0 // site-local fec0::/10
    || (first & 0xff00) === 0xff00 // multicast
    || (first & 0xfe00) === 0xfc00 // unique local fc00::/7
}

/** http(s)이고 호스트의 모든 주소가 공인 주소인지. */
export async function isPublicHttp(uri: URL): Promise<boolean> {
  const scheme = uri.protocol.replace(/:$/, '').toLowerCase()
  if (scheme !== 'http' && scheme !== 'https') return false
  const host = uri.hostname.replace(/^\[|\]$/g, '')
  if (!host) return false
  try {
    const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true })
    if (!addresses.length) return false
    return addresses.every((a) => !(a.family === 4 ? ipv4Blocked(a.address) : ipv6Blocked(a.address)))
  } catch {
    return false
  }
}

/** Java URI.create가 받지 않는 문자(공백·따옴표 등)가 있으면 주소로 보지 않는다. */
export function parseUri(url: string): URL | null {
  if (/[\s<>"{}|\\^`]/.test(url)) return null
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** 리다이렉트를 매번 공인 주소 검사와 함께 최대 3번 따라간 GET 응답. 실패하면 null. */
export async function safeGet(url: string, headers: Record<string, string>, timeoutMs: number): Promise<{ res: Response; url: string } | null> {
  let uri = parseUri(url)
  if (!uri) return null
  let current = url
  let res: Response | null = null
  for (let hop = 0; hop < 4; hop++) {
    if (!(await isPublicHttp(uri))) return null
    res = await fetch(uri, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
    if (Math.floor(res.status / 100) !== 3) break
    const location = res.headers.get('location')
    await res.body?.cancel().catch(() => undefined)
    if (location == null) return null
    uri = new URL(location, uri)
    current = uri.href
  }
  if (!res) return null
  return { res, url: current }
}

/**
 * 사용자가 고른 제품 후보의 대표 이미지를 내려받아 이미지로 저장한다(source_url이 남아 제품 이미지 원본으로 계산된다).
 * 외부 주소이므로 공인 http(s)만 열고 리다이렉트도 매번 같은 검사를 거친다. 실패하면 null을 돌려 등록은 계속된다.
 */
export async function fetchRemoteImage(userId: number, url: string): Promise<number | null> {
  if (url == null || url.length > 1000) return null
  try {
    const got = await safeGet(url, {
      'User-Agent': 'Mozilla/5.0 (compatible; OtgyeolBot/1.0; +product-image)',
      Accept: 'image/jpeg,image/png,image/webp',
    }, 8000)
    if (!got) return null
    const { res } = got
    if (Math.floor(res.status / 100) !== 2) {
      await res.body?.cancel().catch(() => undefined)
      return null
    }
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const body = Buffer.from(await res.arrayBuffer())
    if (!ALLOWED_TYPES.has(type) || body.length === 0 || body.length > MAX_BYTES) return null
    const r = await run('INSERT INTO images (user_id, content_type, data, source_url, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, type, body, url, new Date()])
    return r.insertId
  } catch (e) {
    // 연결 실패·시간 초과·잘못된 주소는 빈 값(Java의 IOException·IllegalArgumentException). DB 오류는 그대로 던진다.
    if (e && typeof e === 'object' && 'sqlState' in e) throw e
    return null
  }
}
