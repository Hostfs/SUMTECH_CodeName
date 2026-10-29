import { Router } from 'express'
import { config } from './config.js'
import { currentSeason } from './dates.js'
import { Season, type Season as SeasonCode } from './domain.js'
import { ApiError, handle } from './http.js'
import { currentUser } from './session.js'

/**
 * 현재 위치 날씨(F11). 기상청 단기예보 조회서비스의 초단기실황(지금 기온·강수)과 단기예보(오늘 최저·최고·강수확률·하늘)를
 * 서버에서 불러와 합친다. 키는 서버 환경변수 KMA_API_KEY에서만 읽고, 같은 격자는 10분 동안 다시 부르지 않는다.
 * 어떤 계절 옷을 고를지는 기온 기준표로 정하고, 실제 옷 고르기는 화면이 내 옷장 목록에서 한다.
 */
export const weatherRouter = Router()

const BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0'
const CACHE_FOR_MS = 10 * 60 * 1000

// ---------- 기상청 격자(weather/KmaGrid.java) ----------

const RE = 6371.00877 // 지구 반경(km)
const GRID = 5.0 // 격자 간격(km)
const toRad = (d: number) => (d / 180) * Math.PI
const SLAT1 = toRad(30.0)
const SLAT2 = toRad(60.0)
const OLON = toRad(126.0)
const OLAT = toRad(38.0)
const XO = 43
const YO = 136

/** 위도·경도를 기상청 동네예보 격자(nx, ny)로 바꾼다(Lambert 정각원추도법). */
export function kmaGrid(lat: number, lon: number): { nx: number; ny: number } {
  const re = RE / GRID
  const sn = Math.log(Math.cos(SLAT1) / Math.cos(SLAT2))
    / Math.log(Math.tan(Math.PI * 0.25 + SLAT2 * 0.5) / Math.tan(Math.PI * 0.25 + SLAT1 * 0.5))
  const sf = Math.pow(Math.tan(Math.PI * 0.25 + SLAT1 * 0.5), sn) * Math.cos(SLAT1) / sn
  const ro = re * sf / Math.pow(Math.tan(Math.PI * 0.25 + OLAT * 0.5), sn)
  const ra = re * sf / Math.pow(Math.tan(Math.PI * 0.25 + toRad(lat) * 0.5), sn)
  let theta = toRad(lon) - OLON
  if (theta > Math.PI) theta -= 2.0 * Math.PI
  if (theta < -Math.PI) theta += 2.0 * Math.PI
  theta *= sn
  const nx = Math.trunc(Math.floor(ra * Math.sin(theta) + XO + 0.5))
  const ny = Math.trunc(Math.floor(ro - ra * Math.cos(theta) + YO + 0.5))
  return { nx, ny }
}

// ---------- 규칙 ----------

/** 기온 기준표: 23°C 이상 여름, 12~22°C 봄·가을, 5~11°C 가을·겨울, 5°C 미만 겨울. */
export function seasonsFor(t: number | null): SeasonCode[] {
  if (t == null) return [currentSeason()]
  if (t >= 23) return ['SUMMER']
  if (t >= 12) return ['SPRING', 'AUTUMN']
  if (t >= 5) return ['AUTUMN', 'WINTER']
  return ['WINTER']
}

/** 강수형태가 있으면 비·눈, 없으면 하늘상태. 밤(19~6시)에 맑으면 달. */
export function iconOf(sky: string | null | undefined, pty: string | null | undefined, hour: number): string {
  if (pty != null && pty !== '0') {
    return pty === '3' || pty === '7' ? 'snow' : 'rain'
  }
  const night = hour >= 19 || hour < 6
  if (sky === '1') return night ? 'moon' : 'sun'
  return sky === '3' ? 'partly' : 'cloud'
}

function skyLabel(code: string | null): string | null {
  switch (code) {
    case '1': return '맑음'
    case '3': return '구름많음'
    case '4': return '흐림'
    default: return null
  }
}

function ptyLabel(code: string): string {
  switch (code) {
    case '1': return '비'
    case '2': return '비 또는 눈'
    case '3': return '눈'
    case '5': return '빗방울'
    case '6': return '빗방울·눈날림'
    case '7': return '눈날림'
    default: return '없음'
  }
}

/** Java Double.parseDouble와 같게 앞뒤 공백을 허용하고, 기상청 누락 값(-900 이하·900 이상)은 null. */
function number(v: string | null | undefined): number | null {
  if (v == null || /^\s*$/.test(v)) return null
  const t = v.trim()
  if (!/^[+-]?(NaN|Infinity|((\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)[fFdD]?)$/.test(t)) return null
  const d = Number(t.replace(/[fFdD]$/, ''))
  return d <= -900 || d >= 900 ? null : d
}

// ---------- 서울 시각(KST는 일광 절약 시간이 없어 UTC+9 고정) ----------

const KST_OFFSET = 9 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/** 서울 벽시계 시각을 UTC 필드로 담은 Date(getUTC*로 읽는다). */
const kst = (epochMs: number) => new Date(epochMs + KST_OFFSET)
const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
const hm = (d: Date) => `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`
const truncHour = (epochMs: number) => Math.floor(epochMs / HOUR) * HOUR

/** Java URLEncoder.encode(UTF-8): 영숫자와 . - * _ 만 그대로, 공백은 +. */
function javaUrlEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/[!'()~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+')
}

/** Java URLDecoder.decode(UTF-8): +는 공백. */
function javaUrlDecode(s: string): string {
  return decodeURIComponent(s.replace(/\+/g, ' '))
}

/** 공공데이터포털은 인코딩 키와 디코딩 키를 함께 준다. 어느 쪽을 넣어도 한 번만 인코딩되게 디코딩해 둔다. */
function serviceKey(): string {
  const k = config.kmaKey.trim()
  if (!k.includes('%')) return k
  try {
    return javaUrlDecode(k)
  } catch {
    return k
  }
}

// ---------- 기상청 호출 ----------

const unavailable = () => new ApiError(502, '기상청 날씨를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.')

async function items(key: string, op: string, base: Date, p: { nx: number; ny: number }, rows: number): Promise<any[]> {
  const url = `${BASE}/${op}?serviceKey=${javaUrlEncode(key)}&pageNo=1&numOfRows=${rows}&dataType=JSON&base_date=${ymd(base)}`
    + `&base_time=${hm(base)}&nx=${p.nx}&ny=${p.ny}`
  let body: string
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) })
    body = await res.text()
  } catch (e) {
    console.warn(`기상청 호출 실패 ${op}: ${e}`)
    throw unavailable()
  }
  // 키 오류 등은 JSON이 아니라 XML로 온다.
  if (body == null || !body.trim().startsWith('{')) {
    console.warn(`기상청 응답이 JSON이 아님 ${op}: ${body == null ? '' : body.slice(0, 200)}`)
    throw unavailable()
  }
  const root = JSON.parse(body)?.response
  const code = str(root?.header?.resultCode)
  if (code !== '00') {
    console.warn(`기상청 결과 코드 ${op} ${code}: ${str(root?.header?.resultMsg)}`)
    throw unavailable()
  }
  const item = root?.body?.items?.item
  if (Array.isArray(item)) return item
  if (item && typeof item === 'object') return Object.values(item)
  return []
}

/** Jackson path(...).asString(): 없으면 빈 문자열, 숫자는 글자로. */
function str(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

interface Hour { label: string; temperature: number | null; icon: string }

async function load(key: string, p: { nx: number; ny: number }, nowMs: number) {
  const now = kst(nowMs)
  // 초단기실황: 매시 정각 자료가 10분쯤 뒤에 나온다.
  const ncstBase = kst(truncHour(nowMs - 10 * 60 * 1000))
  const ncst = new Map<string, string>()
  for (const item of await items(key, 'getUltraSrtNcst', ncstBase, p, 20)) {
    ncst.set(str(item?.category), str(item?.obsrValue))
  }

  // 단기예보: 02시 발표분(02:10쯤 제공)에 오늘 하루 최저·최고가 들어 있다. 그 전이면 전날 23시 발표분을 쓴다.
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const sinceMidnight = now.getTime() - todayStart
  const fcstBase = sinceMidnight < (2 * 60 + 15) * 60 * 1000
    ? new Date(todayStart - HOUR) // 전날 23:00
    : new Date(todayStart + 2 * HOUR)
  const todayYmd = ymd(now)
  const nowHour = hm(new Date(truncHour(now.getTime())))
  let min: number | null = null
  let max: number | null = null
  let pop: number | null = null
  let skyCode: string | null = null
  // 시간대 예보용: '날짜+시각' → {TMP, SKY, PTY}
  const byTime = new Map<string, Map<string, string>>()
  for (const item of await items(key, 'getVilageFcst', fcstBase, p, 1000)) {
    const cat = str(item?.category)
    const time = str(item?.fcstTime)
    const value = str(item?.fcstValue)
    const date = str(item?.fcstDate)
    if (cat === 'TMP' || cat === 'SKY' || cat === 'PTY') {
      const k = date + time
      let m = byTime.get(k)
      if (!m) byTime.set(k, (m = new Map()))
      m.set(cat, value)
    }
    if (todayYmd !== date) continue
    switch (cat) {
      case 'TMN': min = number(value); break
      case 'TMX': max = number(value); break
      case 'POP':
        if (time >= nowHour) {
          const v = number(value)
          if (v != null && (pop == null || v > pop)) pop = Math.trunc(v)
        }
        break
      case 'SKY':
        if (skyCode == null && time >= nowHour) skyCode = value
        break
      default:
    }
  }

  const temp = number(ncst.get('T1H'))
  const pty = ncst.has('PTY') ? ncst.get('PTY')! : '0'
  const hum = number(ncst.get('REH'))
  // 옷 고르기 기준 기온: 오늘 최저·최고가 있으면 그 평균, 없으면 지금 기온.
  const basis = min != null && max != null ? (min + max) / 2 : temp
  const seasons = seasonsFor(basis)
  const reason = basis == null ? '기온을 받지 못해 이번 달 계절로 골랐어요.' : `오늘 평균 ${basis.toFixed(0)}°C 기준`
  // 지금 + 3시간 간격 4칸
  const hours: Hour[] = [{ label: '지금', temperature: temp, icon: iconOf(skyCode, pty, now.getUTCHours()) }]
  const slot = truncHour(now.getTime())
  for (let i = 1; i <= 4; i++) {
    const t = new Date(slot + 3 * i * HOUR)
    const f = byTime.get(ymd(t) + hm(t))
    if (!f) break
    const h = t.getUTCHours()
    hours.push({ label: h === 0 ? '24시' : `${h}시`, temperature: number(f.get('TMP')), icon: iconOf(f.get('SKY'), f.has('PTY') ? f.get('PTY') : '0', h) })
  }
  return {
    observedAt: `${pad(ncstBase.getUTCHours())}:${pad(ncstBase.getUTCMinutes())}`,
    temperature: temp,
    sky: skyLabel(skyCode),
    precipitation: ptyLabel(pty),
    raining: pty !== '0',
    humidity: hum == null ? null : Math.trunc(hum),
    windSpeed: number(ncst.get('WSD')),
    minTemperature: min,
    maxTemperature: max,
    rainChance: pop,
    seasons,
    seasonLabels: seasons.map((s) => Season.label(s)),
    seasonReason: reason,
    hours,
  }
}

type Weather = Awaited<ReturnType<typeof load>>
const cache = new Map<string, { weather: Weather; at: number }>()

/** @RequestParam double: Java Double.parseDouble로 읽을 수 있는 값만. 없거나 아니면 400. */
function doubleParam(v: unknown): number {
  if (typeof v !== 'string' || /^\s*$/.test(v)) throw ApiError.badRequest('입력 형식이 올바르지 않아요.')
  const t = v.trim()
  if (!/^[+-]?(NaN|Infinity|((\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)[fFdD]?)$/.test(t)) throw ApiError.badRequest('입력 형식이 올바르지 않아요.')
  return Number(t.replace(/[fFdD]$/, ''))
}

weatherRouter.get('/weather', handle(async (req) => {
  const lat = doubleParam(req.query.lat)
  const lon = doubleParam(req.query.lon)
  currentUser(req)
  const key = serviceKey()
  if (key === '') {
    throw new ApiError(503, '날씨 서비스가 설정되지 않아 날씨를 보여 줄 수 없어요.')
  }
  if (lat < 32.5 || lat > 39.5 || lon < 124 || lon > 132) {
    throw new ApiError(400, '기상청 예보는 국내 위치만 볼 수 있어요.')
  }
  const p = kmaGrid(lat, lon)
  const nowMs = Date.now()
  const cacheKey = `${p.nx},${p.ny},${truncHour(nowMs)}`
  const hit = cache.get(cacheKey)
  if (hit && hit.at + CACHE_FOR_MS > Date.now()) {
    return hit.weather
  }
  const w = await load(key, p, nowMs)
  if (cache.size > 500) cache.clear()
  cache.set(cacheKey, { weather: w, at: Date.now() })
  return w
}))
