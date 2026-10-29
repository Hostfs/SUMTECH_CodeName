// 2D 앞모습 마네킹의 기준점과, 옷(그림 또는 사진)을 그 몸에 맞춰 입히는 변형(워프).
// 디자인 초안(otgyeol-frontend lib/fit.ts·lib/cutout.ts)을 그대로 옮겼다. 생성형 AI로 옷을 새로 그리지 않고
// 그림·사진의 픽셀을 그대로 늘이고 줄여 맞춘다.
// 초안에서 넓힌 것: 원피스 자리, 옷의 실제 총장(cm)으로 기장 맞추기, 서버에 올린 옷 사진(배경을 지운 PNG 또는 원본)에서 기준점 찾기.
import { shapeOf, type ArtShape } from './garmentShape'
import type { GarmentSummary } from '../types'
import type { Slot } from './outfit'

export type Pt = [number, number]
export type PointName = 'neck' | 'lShoulder' | 'rShoulder' | 'lCuff' | 'rCuff' | 'hem' | 'lWaist' | 'rWaist'
/** 옷 그림·사진 픽셀 좌표의 핏 기준점: 상의·아우터·원피스는 목·어깨·소매 끝·밑단, 하의는 허리·밑단 */
export type Points = Partial<Record<PointName, Pt>>
/** 입히는 방식. 겉옷은 안에 입은 옷 위로 넉넉하게, 원피스는 상의처럼 맞추되 밑단이 더 내려간다 */
export type Kind = 'top' | 'outer' | 'bottom' | 'dress'
export const KIND_OF: Record<Slot, Kind> = { OUTER: 'outer', TOP: 'top', BOTTOM: 'bottom', DRESS: 'dress' }

/** 1cm 를 몇 단위로 그릴지 */
const U = 3.6
const VIEW_W = 360
/** 기본 체형(키 170cm). 치수 입력은 이번 범위가 아니라 평균 비율만 쓴다 */
const BODY_CM = 170

export interface Geo {
  W: number
  H: number
  cx: number
  u: number
  top: number
  height: number
  Y: (f: number) => number
  neckBase: Pt
  neckHalf: number
  lSh: Pt
  rSh: Pt
  lWrist: Pt
  rWrist: Pt
  chestHalf: number
  waistY: number
  waistHalf: number
  hipY: number
  hipHalf: number
  crotchY: number
  kneeY: number
  ankleY: number
  floorY: number
  legX: number
  /** 팔이 어깨에서 시작하는 중심 / 윗팔 반지름 / 팔 길이(어깨→손목) */
  armTop: [number, number]
  armR: number
  armLen: number
  /** 옷이 덮어야 하는 어깨 바깥 반너비 (팔 바깥 가장자리) */
  outerHalf: number
}

/** 둘레(cm) → 타원 단면의 반너비(cm). rd 는 앞뒤/좌우 비율 */
const half = (c: number, rd: number) => c / (2 * Math.PI) / Math.sqrt((1 + rd * rd) / 2)

export function geometry(): Geo {
  const cm = BODY_CM
  const waist = cm * 0.4
  const chest = cm * 0.5
  const hip = Math.max(cm * 0.52, waist * 1.12)
  const shoulder = cm * 0.235
  const top = 34
  const height = cm * U
  const floorY = top + height
  const Y = (f: number) => top + f * height
  const cx = VIEW_W / 2
  const shHalf = (shoulder / 2) * U
  const armLen = 0.285 * height
  const a = (8 * Math.PI) / 180
  const lSh: Pt = [cx - shHalf, Y(0.205)]
  const rSh: Pt = [cx + shHalf, Y(0.205)]
  const hipHalf = half(hip, 0.68) * U
  const armR = 4.3 * U
  const armTop = Math.max(0, shHalf - armR * 0.62)
  const armY = lSh[1] + 0.03 * height
  return {
    W: VIEW_W,
    H: floorY + 44,
    cx,
    u: U,
    top,
    height,
    Y,
    neckBase: [cx, Y(0.172)],
    neckHalf: 0.032 * height,
    lSh,
    rSh,
    lWrist: [cx - armTop - Math.sin(a) * armLen, armY + Math.cos(a) * armLen],
    rWrist: [cx + armTop + Math.sin(a) * armLen, armY + Math.cos(a) * armLen],
    armTop: [armTop, armY],
    armR,
    armLen,
    outerHalf: armTop + armR,
    chestHalf: half(chest, 0.62) * U,
    waistY: Y(0.372),
    waistHalf: half(waist, 0.7) * U,
    hipY: Y(0.47),
    hipHalf,
    crotchY: Y(0.52),
    kneeY: Y(0.715),
    ankleY: Y(0.955),
    floorY,
    legX: hipHalf * 0.5,
  }
}

// ---------------------------------------------------------------- 옷 스프라이트 (사진 또는 일러스트를 래스터로)
export interface Sprite {
  img: CanvasImageSource
  w: number
  h: number
  points: Points
  kind: Kind
  /** 일러스트 전용: 밑단이 닿을 키 비율(머리 끝=0, 바닥=1), 소매가 팔 길이의 몇 %까지 내려오는지 */
  hemAt?: number
  sleeve?: number
}
export interface Fit {
  width: number
  length: number
}
export const DEFAULT_FIT: Fit = { width: 1, length: 1 }

interface ArtFit {
  hemAt: number
  sleeve?: number
  /** 그림의 기본 기장이 나타내는 총장(cm). 실제 총장이 있으면 이 비율만큼 밑단을 올리고 내린다 */
  cm: number
  p: Points
}
const SLEEVE_TOP = (hem: number): Points => ({ neck: [48, 15], lShoulder: [20, 18], rShoulder: [76, 18], lCuff: [15, 66], rCuff: [81, 66], hem: [48, hem] })
/** 일러스트(96×96)의 기준점. 사진이 없는 옷도 같은 방식으로 입힌다 */
const ART: Partial<Record<ArtShape, ArtFit>> = {
  tee: { hemAt: 0.5, sleeve: 0.42, cm: 68, p: { neck: [48, 15], lShoulder: [18, 20], rShoulder: [78, 20], lCuff: [12, 43], rCuff: [84, 43], hem: [48, 84] } },
  longtee: { hemAt: 0.5, sleeve: 1, cm: 68, p: SLEEVE_TOP(84) },
  knit: { hemAt: 0.5, sleeve: 1, cm: 66, p: SLEEVE_TOP(84) },
  shirt: { hemAt: 0.52, sleeve: 1, cm: 74, p: SLEEVE_TOP(86) },
  blazer: { hemAt: 0.56, sleeve: 1, cm: 72, p: { neck: [48, 14], lShoulder: [18, 18], rShoulder: [78, 18], lCuff: [13, 67], rCuff: [83, 67], hem: [48, 78] } },
  coat: { hemAt: 0.7, sleeve: 1, cm: 105, p: { neck: [48, 14], lShoulder: [18, 18], rShoulder: [78, 18], lCuff: [13, 67], rCuff: [83, 67], hem: [48, 92] } },
  puffer: { hemAt: 0.58, sleeve: 1, cm: 70, p: { neck: [48, 15], lShoulder: [18, 18], rShoulder: [78, 18], lCuff: [13, 64], rCuff: [83, 64], hem: [48, 86] } },
  // 초안에 없던 원피스(짧은 소매 A라인): 상의처럼 목·어깨·소매로 맞추고 밑단은 무릎 아래까지
  dress: { hemAt: 0.74, sleeve: 0.3, cm: 100, p: { neck: [48, 13], lShoulder: [24, 15], rShoulder: [72, 15], lCuff: [19.5, 35.5], rCuff: [76.5, 35.5], hem: [48, 90] } },
  pants: { hemAt: 0.955, cm: 100, p: { lWaist: [28, 8], rWaist: [68, 8], hem: [48, 90] } },
  shorts: { hemAt: 0.7, cm: 48, p: { lWaist: [28, 20], rWaist: [68, 20], hem: [48, 64] } },
  skirt: { hemAt: 0.7, cm: 55, p: { lWaist: [33, 16], rWaist: [63, 16], hem: [48, 82] } },
  pleated: { hemAt: 0.72, cm: 55, p: { lWaist: [33, 16], rWaist: [63, 16], hem: [48, 82] } },
}
/** 자리에 맞지 않는 그림이 오면(예: 기타 종류) 자리의 기본 그림으로 입힌다 */
const SLOT_ART: Record<Kind, ArtShape> = { top: 'tee', outer: 'blazer', bottom: 'pants', dress: 'dress' }
export const ART_SIZE = 384

/** 어깨 바깥 가장자리(팔 끝) 대비 품. 겉옷은 안에 입은 옷 위로 넉넉하게 */
const BASE_WIDTH: Record<Kind, number> = { top: 1, outer: 1.12, bottom: 1.02, dress: 1 }
/** 옷 길이가 지나치게 길 때 밑단이 내려갈 수 있는 한계(키 비율) */
const MAX_HEM: Record<Kind, number> = { top: 0.56, outer: 0.78, bottom: 0.975, dress: 0.86 }
/** 총장을 재는 시작 높이(키 비율): 상의는 목 밑(어깨 꼭대기), 하의는 허리선이 놓이는 곳 */
const NECK_AT = 0.172
const WAIST_AT = 0.372 + 0.28 * (0.47 - 0.372)

/** 코디 화면에서 쓰는 그림 모양. 기본은 옷장 그림(shapeOf)과 같고, 이름으로 분명히 알 수 있는 것만 더 맞는 모양으로 */
export function studioShape(g: Pick<GarmentSummary, 'subType' | 'name' | 'category'>): ArtShape {
  if (g.category === 'OUTER' && /패딩|푸퍼|다운/.test(g.name)) return 'puffer'
  if (g.category === 'BOTTOM' && /플리츠/.test(g.name)) return 'pleated'
  return shapeOf(g.subType)
}

export interface Look {
  shape: ArtShape
  kind: Kind
  /** 밑단 높이(키 비율). 총장이 있으면 그 길이에 맞춘다 */
  hemAt: number
  sleeve?: number
}

/** 옷 한 벌을 마네킹에 어떤 모양·기장으로 입힐지 */
export function lookOf(g: Pick<GarmentSummary, 'subType' | 'name' | 'category' | 'totalLengthCm'>, slot: Slot): Look {
  const kind = KIND_OF[slot]
  let shape = studioShape(g)
  const fitsSlot = (s: ArtShape) => {
    const a = ART[s]
    return !!a && (kind === 'bottom') === !!a.p.lWaist && (kind !== 'dress' || s === 'dress')
  }
  if (!fitsSlot(shape)) shape = SLOT_ART[kind]
  const a = ART[shape]!
  let hemAt = a.hemAt
  const cm = g.totalLengthCm
  if (cm && cm > 0) {
    const start = kind === 'bottom' ? WAIST_AT : NECK_AT
    const want = start + (cm / a.cm) * (a.hemAt - start)
    hemAt = Math.min(MAX_HEM[kind], Math.max(start + 0.55 * (a.hemAt - start), want))
  }
  return { shape, kind, hemAt: Math.round(hemAt * 1000) / 1000, sleeve: a.sleeve }
}

export function artSprite(look: Look, img: CanvasImageSource): Sprite {
  const a = ART[look.shape] ?? ART[SLOT_ART[look.kind]]!
  const k = ART_SIZE / 96
  const points: Points = {}
  for (const [name, p] of Object.entries(a.p) as [PointName, Pt][]) points[name] = [p[0] * k, p[1] * k]
  return { img, w: ART_SIZE, h: ART_SIZE, points, kind: look.kind, hemAt: look.hemAt, sleeve: look.sleeve }
}

// ---------------------------------------------------------------- 변형
interface Anchor { s: Pt; r: Pt }

/** 기준점마다 어긋난 만큼(r)을 주변에 거리 반비례로 퍼뜨린다 (Shepard). 기준점 위에서는 정확히 맞는다 */
function spread(p: Pt, anchors: Anchor[]): Pt {
  let sx = 0, sy = 0, sw = 0
  for (const a of anchors) {
    const dx = p[0] - a.s[0], dy = p[1] - a.s[1]
    const d2 = dx * dx + dy * dy
    if (d2 < 1e-6) return a.r
    const w = 1 / (d2 * Math.sqrt(d2))
    sx += w * a.r[0]; sy += w * a.r[1]; sw += w
  }
  return [sx / sw, sy / sw]
}

const ramp = (v: number) => { const t = Math.min(1, Math.max(0, v)); return t * t * (3 - 2 * t) }

/** 사진 좌표 → 마네킹 좌표 */
export function makeWarp(sprite: Sprite, geo: Geo, fit: Fit): (p: Pt) => Pt {
  const P = sprite.points
  if (sprite.kind === 'bottom' && P.lWaist && P.rWaist) {
    const lW = P.lWaist, rW = P.rWaist
    const srcW = Math.max(10, rW[0] - lW[0])
    const k = (geo.hipHalf * 2 * BASE_WIDTH.bottom * fit.width) / srcW
    const midX = (lW[0] + rW[0]) / 2
    const yTop = (lW[1] + rW[1]) / 2
    const dstTop = geo.waistY + 0.28 * (geo.hipY - geo.waistY)
    const hemSrc = P.hem?.[1] ?? sprite.h
    // 밑단 위치: 일러스트는 정해진 길이로, 사진은 비율 그대로 두되 발목 아래로 내려가지 않게
    let hemDst = dstTop + (hemSrc - yTop) * k * fit.length
    if (sprite.hemAt != null) hemDst = geo.Y(sprite.hemAt) * fit.length + (1 - fit.length) * dstTop
    hemDst = Math.min(hemDst, geo.Y(MAX_HEM.bottom))
    const ky = (hemDst - dstTop) / Math.max(10, hemSrc - yTop)
    return (p) => [geo.cx + (p[0] - midX) * k, dstTop + (p[1] - yTop) * ky]
  }
  if (sprite.kind !== 'bottom' && P.neck && P.lShoulder && P.rShoulder) {
    const neck = P.neck, lS = P.lShoulder, rS = P.rShoulder
    const sSrc = Math.max(10, rS[0] - lS[0])
    // 어깨 솔기는 팔 바깥 가장자리에 둔다. 소매 없는 원피스 사진은 몸의 어깨 끝에 둔다
    const shoulderHalf = sprite.kind === 'dress' && !P.lCuff ? geo.rSh[0] - geo.cx : geo.outerHalf + 2
    const sDst = 2 * shoulderHalf * BASE_WIDTH[sprite.kind] * fit.width
    const kx = sDst / sSrc
    const ky = kx * fit.length
    const midX = (lS[0] + rS[0]) / 2
    const neckDst: Pt = [geo.cx, geo.neckBase[1] - 7]
    const base = (p: Pt): Pt => [geo.cx + (p[0] - midX) * kx, neckDst[1] + (p[1] - neck[1]) * ky]

    const hemSrc = P.hem?.[1] ?? sprite.h
    const want = (src: Pt, dst: Pt): Anchor => {
      const b = base(src)
      return { s: src, r: [dst[0] - b[0], dst[1] - b[1]] }
    }
    // 밑단: 일러스트는 정해진 길이, 사진은 비율 그대로 두되 너무 길면 한계에서 멈춘다
    const hemNat = base([midX, hemSrc])[1]
    let hemDst = sprite.hemAt != null ? geo.Y(sprite.hemAt) + (fit.length - 1) * (geo.crotchY - neckDst[1]) * 0.5 : hemNat
    hemDst = Math.min(hemDst, geo.Y(MAX_HEM[sprite.kind]))
    const dHem = hemDst - hemNat
    const hemPin = (x: number, y: number): Anchor => ({ s: [x, y], r: [0, dHem] })
    const pin = (x: number, y: number): Anchor => ({ s: [x, y], r: [0, 0] })
    const sh = rS[0] - lS[0]
    const anchors: Anchor[] = [
      pin(neck[0], neck[1]),
      want(lS, [geo.cx - sDst / 2, geo.lSh[1] + 2]),
      want(rS, [geo.cx + sDst / 2, geo.rSh[1] + 2]),
      hemPin(midX, hemSrc),
      hemPin(lS[0] + 0.1 * sh, hemSrc),
      hemPin(rS[0] - 0.1 * sh, hemSrc),
      { s: [midX, (lS[1] + hemSrc) / 2], r: [0, dHem / 2] },
      { s: [lS[0] + 0.14 * sh, (lS[1] + hemSrc) / 2], r: [0, dHem / 2] },
      { s: [rS[0] - 0.14 * sh, (lS[1] + hemSrc) / 2], r: [0, dHem / 2] },
    ]
    // 소매: 사진 속 소매를 하나의 덩어리로 보고, 어깨 솔기를 축으로 돌려 마네킹 팔 축에 눕힌다.
    // 길이는 손목 위에서 멈추고(손이 가려지지 않게), 길면 소매 전체를 같은 비율로 줄여 폭도 같이 날씬해진다.
    // 소매 끝보다 아래(원피스 치맛자락 등)는 소매로 보지 않는다.
    const sleeves: ((p: Pt) => { w: number; q: Pt })[] = []
    if (P.lCuff && P.rCuff) {
      for (const s of [-1, 1] as const) {
        const cuff = s === -1 ? P.lCuff : P.rCuff
        const S = s === -1 ? lS : rS
        const D0: Pt = [geo.cx + (s * sDst) / 2, (s === -1 ? geo.lSh[1] : geo.rSh[1]) + 2]
        const o: Pt = [geo.cx + s * geo.armTop[0], geo.armTop[1]]
        const wr: Pt = s === -1 ? geo.lWrist : geo.rWrist
        const full = Math.hypot(wr[0] - o[0], wr[1] - o[1])
        const dir: Pt = [(wr[0] - o[0]) / full, (wr[1] - o[1]) / full]
        const maxLen = full - 1.6 * geo.u
        const natLen = Math.hypot(cuff[0] - S[0], cuff[1] - S[1]) || 1
        const want2 = sprite.sleeve != null ? full * sprite.sleeve : natLen * kx
        const len = Math.min(maxLen, want2 * fit.length)
        const C: Pt = [o[0] + dir[0] * len, o[1] + dir[1] * len]
        const dl = Math.hypot(C[0] - D0[0], C[1] - D0[1]) || 1
        const ks = dl / natLen
        const th = Math.atan2(C[1] - D0[1], C[0] - D0[0]) - Math.atan2(cuff[1] - S[1], cuff[0] - S[0])
        const ca = ks * Math.cos(th), sa = ks * Math.sin(th)
        const below = cuff[1] + 0.12 * sh
        sleeves.push((p) => {
          const vx = p[0] - S[0], vy = p[1] - S[1]
          const d = s === -1 ? S[0] + 0.14 * sh - p[0] : p[0] - (S[0] - 0.14 * sh)
          const wx = ramp(d / (0.2 * sh))
          const wy = ramp((p[1] - (S[1] - 0.05 * sh)) / (0.1 * sh))
          const wz = 1 - ramp((p[1] - below) / (0.12 * sh))
          return { w: wx * wy * wz, q: [D0[0] + ca * vx - sa * vy, D0[1] + sa * vx + ca * vy] }
        })
      }
    }
    return (p) => {
      const b = base(p)
      const d = spread(p, anchors)
      let r: Pt = [b[0] + d[0], b[1] + d[1]]
      for (const f of sleeves) {
        const { w, q } = f(p)
        if (w > 0) r = [r[0] * (1 - w) + q[0] * w, r[1] * (1 - w) + q[1] * w]
      }
      return r
    }
  }
  // 기준점이 없으면 가슴 높이에 폭만 맞춘다
  const k = (geo.hipHalf * 2) / sprite.w
  return (p) => [geo.cx + (p[0] - sprite.w / 2) * k, geo.hipY + p[1] * k]
}

// ---------------------------------------------------------------- 그리기
function triangle(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s: Pt[], d: Pt[]) {
  const det = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1])
  if (Math.abs(det) < 1e-6) return
  const a = ((d[1][0] - d[0][0]) * (s[2][1] - s[0][1]) - (d[2][0] - d[0][0]) * (s[1][1] - s[0][1])) / det
  const c = ((d[2][0] - d[0][0]) * (s[1][0] - s[0][0]) - (d[1][0] - d[0][0]) * (s[2][0] - s[0][0])) / det
  const b = ((d[1][1] - d[0][1]) * (s[2][1] - s[0][1]) - (d[2][1] - d[0][1]) * (s[1][1] - s[0][1])) / det
  const e2 = ((d[2][1] - d[0][1]) * (s[1][0] - s[0][0]) - (d[1][1] - d[0][1]) * (s[2][0] - s[0][0])) / det
  const e = d[0][0] - a * s[0][0] - c * s[0][1]
  const f = d[0][1] - b * s[0][0] - e2 * s[0][1]
  // 삼각형 사이 실선이 비치지 않도록 클립을 0.7 만큼 바깥으로 넓힌다
  const g: Pt = [(d[0][0] + d[1][0] + d[2][0]) / 3, (d[0][1] + d[1][1] + d[2][1]) / 3]
  ctx.save()
  ctx.beginPath()
  d.forEach((p, i) => {
    const dx = p[0] - g[0], dy = p[1] - g[1]
    const l = Math.hypot(dx, dy) || 1
    const q: Pt = [p[0] + (dx / l) * 0.7, p[1] + (dy / l) * 0.7]
    if (i === 0) ctx.moveTo(q[0], q[1])
    else ctx.lineTo(q[0], q[1])
  })
  ctx.closePath()
  ctx.clip()
  ctx.transform(a, b, c, e2, e, f)
  const x0 = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0]) - 1))
  const y0 = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1]) - 1))
  const x1 = Math.ceil(Math.max(s[0][0], s[1][0], s[2][0]) + 1)
  const y1 = Math.ceil(Math.max(s[0][1], s[1][1], s[2][1]) + 1)
  ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
  ctx.restore()
}

/** 사진을 격자로 쪼개 각 점을 워프한 위치로 옮겨 그린다 */
export function drawGarment(ctx: CanvasRenderingContext2D, sprite: Sprite, geo: Geo, fit: Fit) {
  const warp = makeWarp(sprite, geo, fit)
  const cols = 14, rows = 18
  const grid: { s: Pt; d: Pt }[][] = []
  for (let r = 0; r <= rows; r++) {
    const line: { s: Pt; d: Pt }[] = []
    for (let c = 0; c <= cols; c++) {
      const s: Pt = [(c / cols) * sprite.w, (r / rows) * sprite.h]
      line.push({ s, d: warp(s) })
    }
    grid.push(line)
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = grid[r][c], b = grid[r][c + 1], d = grid[r + 1][c], e = grid[r + 1][c + 1]
      triangle(ctx, sprite.img, [a.s, b.s, d.s], [a.d, b.d, d.d])
      triangle(ctx, sprite.img, [b.s, e.s, d.s], [b.d, e.d, d.d])
    }
  }
}

// ---------------------------------------------------------------- 옷 사진 → 누끼 → 기준점 (초안 lib/cutout.ts)
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('이미지를 읽지 못했어요'))
    img.src = src
  })
}

const pix = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height)

function toCanvas(img: HTMLImageElement, maxSide = 900): HTMLCanvasElement {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * k))
  c.height = Math.max(1, Math.round(img.naturalHeight * k))
  c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, c.width, c.height)
  return c
}

/** 8방향 연결 성분 중 가장 큰 것만 남긴다 */
function keepLargest(mask: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h)
  let best = 0, bestSize = 0, next = 0
  const stack: number[] = []
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || label[i]) continue
    next++
    let size = 0
    stack.push(i)
    label[i] = next
    while (stack.length) {
      const p = stack.pop()!
      size++
      const x = p % w, y = (p / w) | 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (mask[q] && !label[q]) {
            label[q] = next
            stack.push(q)
          }
        }
      }
    }
    if (size > bestSize) {
      bestSize = size
      best = next
    }
  }
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = label[i] === best ? 1 : 0
  return out
}

/** 가장자리를 1px 부드럽게 (톱니 제거) */
function feather(mask: Uint8Array, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) sum += mask[Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))]
      }
      out[y * w + x] = Math.round((sum / 9) * 255)
    }
  }
  return out
}

/** 투명도가 있는 그림을 옷 둘레만 남기고(여백 2%) 잘라 낸다 */
function cropToAlpha(full: HTMLCanvasElement): HTMLCanvasElement | null {
  const { width: w, height: h } = full
  const d = pix(full).data
  let x0 = w, y0 = h, x1 = 0, y1 = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 - x0 < 8 || y1 - y0 < 8) return null
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02)
  const cx0 = Math.max(0, x0 - pad), cy0 = Math.max(0, y0 - pad)
  const cw = Math.min(w, x1 + pad + 1) - cx0, ch = Math.min(h, y1 + pad + 1) - cy0
  const out = document.createElement('canvas')
  out.width = cw
  out.height = ch
  out.getContext('2d', { willReadFrequently: true })!.drawImage(full, cx0, cy0, cw, ch, 0, 0, cw, ch)
  return out
}

/** 마스크를 알파로 입혀 옷만 남기고 여백을 잘라 낸다 */
function applyMask(src: HTMLCanvasElement, mask: Uint8Array): HTMLCanvasElement | null {
  const { width: w, height: h } = src
  const alpha = feather(mask, w, h)
  const data = pix(src)
  for (let i = 0; i < w * h; i++) data.data[i * 4 + 3] = alpha[i]
  const full = document.createElement('canvas')
  full.width = w
  full.height = h
  full.getContext('2d', { willReadFrequently: true })!.putImageData(data, 0, 0)
  return cropToAlpha(full)
}

/** 가장자리 색의 중앙값을 배경색으로 보고, 가장자리에서 이어진 비슷한 색을 지운다. plain 은 배경이 한 가지 색에 가까운지 */
function flatBackgroundMask(c: HTMLCanvasElement, tolerance: number): { mask: Uint8Array; plain: boolean; fraction: number } {
  const { width: w, height: h } = c
  const d = pix(c).data
  const rs: number[] = [], gs: number[] = [], bs: number[] = []
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4
    rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2])
  }
  for (let x = 0; x < w; x++) { take(x, 0); take(x, h - 1) }
  for (let y = 0; y < h; y++) { take(0, y); take(w - 1, y) }
  const med = (a: number[]) => [...a].sort((p, q) => p - q)[a.length >> 1]
  const bg = [med(rs), med(gs), med(bs)]
  const spreadOf = rs.reduce((s, v, i) => s + Math.abs(v - bg[0]) + Math.abs(gs[i] - bg[1]) + Math.abs(bs[i] - bg[2]), 0) / (rs.length * 3)

  const near = (i: number) => {
    const dr = d[i * 4] - bg[0], dg = d[i * 4 + 1] - bg[1], db = d[i * 4 + 2] - bg[2]
    return Math.sqrt(dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.9) < tolerance
  }
  const isBg = new Uint8Array(w * h)
  const stack: number[] = []
  const seed = (x: number, y: number) => {
    const i = y * w + x
    if (!isBg[i] && near(i)) { isBg[i] = 1; stack.push(i) }
  }
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1) }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y) }
  while (stack.length) {
    const p = stack.pop()!
    const x = p % w, y = (p / w) | 0
    if (x > 0) seed(x - 1, y)
    if (x < w - 1) seed(x + 1, y)
    if (y > 0) seed(x, y - 1)
    if (y < h - 1) seed(x, y + 1)
  }
  let mask: Uint8Array = new Uint8Array(w * h)
  for (let i = 0; i < mask.length; i++) mask[i] = isBg[i] ? 0 : 1
  mask = keepLargest(mask, w, h)

  // 팔과 몸통 사이처럼 배경이 안쪽에 갇힌 구멍도 지운다 (배경색과 비슷하고 어느 정도 넓은 것만)
  const seen = new Uint8Array(w * h)
  const minHole = w * h * 0.002
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i] || !near(i)) continue
    const comp: number[] = []
    stack.push(i)
    seen[i] = 1
    while (stack.length) {
      const p = stack.pop()!
      comp.push(p)
      const x = p % w, y = (p / w) | 0
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const q = ny * w + nx
        if (mask[q] && !seen[q] && near(q)) { seen[q] = 1; stack.push(q) }
      }
    }
    if (comp.length > minHole) for (const p of comp) mask[p] = 0
  }
  let count = 0
  for (let i = 0; i < mask.length; i++) count += mask[i]
  return { mask, plain: spreadOf < 22, fraction: count / mask.length }
}

/** 가장자리의 대부분이 투명하면 이미 배경을 지운 사진(대표 이미지 정리 결과)이다 */
function isCutout(c: HTMLCanvasElement): boolean {
  const { width: w, height: h } = c
  const d = pix(c).data
  let clear = 0, n = 0
  const at = (x: number, y: number) => { n++; if (d[(y * w + x) * 4 + 3] < 16) clear++ }
  for (let x = 0; x < w; x += 4) { at(x, 0); at(x, h - 1) }
  for (let y = 0; y < h; y += 4) { at(0, y); at(w - 1, y) }
  return clear / n > 0.6
}

function silhouette(c: HTMLCanvasElement) {
  const { width: w, height: h } = c
  const d = pix(c).data
  const on = (x: number, y: number) => d[(y * w + x) * 4 + 3] > 128
  const top = new Int32Array(w).fill(-1)
  const bottom = new Int32Array(w).fill(-1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) if (on(x, y)) { top[x] = y; break }
    for (let y = h - 1; y >= 0; y--) if (on(x, y)) { bottom[x] = y; break }
  }
  const span = (y: number, x0: number, x1: number): [number, number] | null => {
    let l = -1, r = -1
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) if (on(x, y)) { if (l < 0) l = x; r = x }
    return l < 0 ? null : [l, r]
  }
  return { w, h, top, bottom, span }
}

/** 누끼 딴 옷의 윤곽에서 핏 기준점을 찾는다 */
function estimatePoints(c: HTMLCanvasElement, kind: 'top' | 'bottom'): Points {
  const { w, h, top, bottom, span } = silhouette(c)
  if (kind === 'bottom') {
    const yTop = top.reduce((m, v) => (v >= 0 && (m < 0 || v < m) ? v : m), -1)
    const yBot = bottom.reduce((m, v) => Math.max(m, v), 0)
    const row = span(Math.min(h - 1, yTop + Math.round(h * 0.03)), 0, w) ?? [0, w - 1]
    return { lWaist: [row[0], yTop], rWaist: [row[1], yTop], hem: [w / 2, yBot] }
  }
  const sm = (arr: Int32Array, x: number, r = 3) => {
    let s = 0, n = 0
    for (let i = -r; i <= r; i++) { const v = arr[Math.min(w - 1, Math.max(0, x + i))]; if (v >= 0) { s += v; n++ } }
    return n ? s / n : h
  }
  // 목: 가운데 구간에서 가장 높은 곳
  let neckY = h
  for (let x = Math.floor(w * 0.38); x <= Math.ceil(w * 0.62); x++) neckY = Math.min(neckY, sm(top, x))
  const neckXs: number[] = []
  for (let x = Math.floor(w * 0.38); x <= Math.ceil(w * 0.62); x++) if (sm(top, x) <= neckY + h * 0.02) neckXs.push(x)
  const neckX = neckXs.length ? neckXs.reduce((a, b) => a + b, 0) / neckXs.length : w / 2

  // 어깨 끝: 목에서 폭의 약 1/3 바깥을 기준으로, 윗선이 소매쪽으로 꺾여 내려가기 시작하는 곳을 찾아 그 근처로 맞춘다
  const tip = (dir: -1 | 1): Pt => {
    const guess = Math.round(neckX + dir * 0.32 * w)
    const clamp = (v: number) => Math.min(guess + 0.1 * w, Math.max(guess - 0.1 * w, v))
    let found = -1
    for (let x = Math.round(neckX + dir * 0.12 * w); x > 4 && x < w - 5; x += dir) {
      if (Math.abs(x - neckX) > 0.46 * w) break
      if (sm(top, x + dir * 4) - sm(top, x) > 3.6) { found = x; break }
    }
    const x = Math.max(2, Math.min(w - 3, found >= 0 ? clamp(found) : guess))
    return [x, sm(top, x, 2)]
  }
  const ls = tip(-1)
  const rs = tip(1)

  // 소매 끝: 어깨 바깥쪽 영역에서 가장 아래
  const cuff = (x0: number, x1: number): Pt => {
    let by = -1, bx = (x0 + x1) / 2
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) if (bottom[x] > by) { by = bottom[x]; bx = x }
    const xs: number[] = []
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) if (bottom[x] >= by - 3) xs.push(x)
    if (xs.length) bx = xs.reduce((a, b) => a + b, 0) / xs.length
    return [bx, by]
  }
  const lc = cuff(0, Math.max(ls[0], w * 0.1))
  const rc = cuff(Math.min(rs[0], w * 0.9), w - 1)

  // 밑단: 가운데 구간 가장 아래
  let hemY = 0
  for (let x = Math.floor(w * 0.34); x <= Math.ceil(w * 0.66); x++) hemY = Math.max(hemY, bottom[x])
  return { neck: [neckX, neckY], lShoulder: ls, rShoulder: rs, lCuff: lc, rCuff: rc, hem: [neckX, hemY] }
}

/**
 * 옷 사진을 입힐 수 있는 스프라이트로. 배경을 지운 사진은 그대로 쓰고, 배경이 한 가지 색이면 지운다.
 * 배경이 복잡해 옷만 골라낼 수 없으면 null(그림으로 입힌다).
 */
export async function photoSprite(url: string, kind: Kind): Promise<Sprite | null> {
  const src = toCanvas(await loadImage(url))
  let cut: HTMLCanvasElement | null = null
  if (isCutout(src)) cut = cropToAlpha(src)
  else {
    const flat = flatBackgroundMask(src, 36)
    if (flat.plain && flat.fraction > 0.05 && flat.fraction < 0.82) cut = applyMask(src, flat.mask)
  }
  if (!cut) return null
  const points = estimatePoints(cut, kind === 'bottom' ? 'bottom' : 'top')
  // 원피스 사진은 치맛자락이 소매 끝으로 잡히기 쉬워 소매는 맞추지 않는다
  if (kind === 'dress') {
    delete points.lCuff
    delete points.rCuff
  }
  return { img: cut, w: cut.width, h: cut.height, points, kind }
}

// ---------------------------------------------------------------- 사진 옷의 품·기장 (이 기기에 기억)
const FIT_KEY = 'ot.outfit.fit.v1'

export function loadFits(): Record<number, Fit> {
  try {
    const v = JSON.parse(localStorage.getItem(FIT_KEY) ?? '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

export function saveFits(fits: Record<number, Fit>) {
  try {
    localStorage.setItem(FIT_KEY, JSON.stringify(fits))
  } catch {
    /* 저장하지 못해도 지금 화면에서는 그대로 보인다 */
  }
}
