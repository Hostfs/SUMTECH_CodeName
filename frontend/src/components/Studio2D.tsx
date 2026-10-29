import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { ShapeArt } from './GarmentArt'
import { ART_SIZE, DEFAULT_FIT, artSprite, drawGarment, geometry, loadImage, lookOf, photoSprite, type Fit, type Geo, type Kind, type Pt, type Sprite } from '../lib/fit'
import { LAYER_ORDER, type Picks, type Slot } from '../lib/outfit'
import type { GarmentSummary } from '../types'

// 2D 앞모습 마네킹 + 옷을 몸에 맞춰 입히는 캔버스(디자인 초안 components/Studio2D 그대로).
// 사진이 있는 옷은 배경을 지운 사진을, 없는 옷은 일러스트를 같은 방식(기준점 워프)으로 입힌다.

// 사진 한 장의 누끼·기준점 찾기는 한 번만 한다
const photoCache = new Map<string, Promise<Sprite | null>>()
function cachedPhoto(url: string, kind: Kind) {
  const key = `${url}|${kind}`
  let p = photoCache.get(key)
  if (!p) {
    p = photoSprite(url, kind).catch(() => null)
    photoCache.set(key, p)
  }
  return p
}

/** 옷 하나를 그릴 수 있는 형태(사진 또는 일러스트 스프라이트)로 준비한다. 일러스트는 숨겨 둔 그림(arts)을 이미지로 바꾼다 */
function useSprite(slot: Slot, g: GarmentSummary | undefined, arts: RefObject<HTMLDivElement | null>): Sprite | null {
  const look = g ? lookOf(g, slot) : null
  const id = g?.id ?? null
  const photo = g?.imageUrl ?? null
  const hex = g?.colorHex ?? null
  const shape = look?.shape ?? null
  const kind = look?.kind ?? null
  const hemAt = look?.hemAt ?? null
  const sleeve = look?.sleeve ?? null
  const key = id == null ? '' : `${id}|${photo}|${shape}|${hex}|${hemAt}`
  const [state, setState] = useState<{ key: string; sprite: Sprite | null }>({ key: '', sprite: null })

  useEffect(() => {
    if (id == null || !shape || !kind || hemAt == null) return
    let alive = true
    ;(async () => {
      let sprite = photo ? await cachedPhoto(photo, kind) : null
      if (!sprite) {
        // 사진이 없거나 배경을 지우지 못한 사진은 그림으로 입힌다
        const svg = arts.current?.querySelector(`svg.art-${slot}`)
        if (svg) {
          const markup = new XMLSerializer().serializeToString(svg)
          const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)).catch(() => null)
          if (img) sprite = artSprite({ shape, kind, hemAt, sleeve: sleeve ?? undefined }, img)
        }
      }
      if (alive) setState({ key, sprite })
    })()
    return () => {
      alive = false
    }
  }, [key, id, photo, shape, kind, hemAt, sleeve, slot, arts])
  // 새 옷을 준비하는 동안은 앞 옷을 그대로 두어 깜빡이지 않게 한다
  return id == null ? null : state.sprite
}

/** 밤 화면(data-tone=dark)인지. 어두운 바탕에서는 옷 그림자 대신 옅은 빛 테두리를 깐다 */
function useDarkTone(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.dataset.tone === 'dark')
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setDark(el.dataset.tone === 'dark'))
    obs.observe(el, { attributes: true, attributeFilter: ['data-tone'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

// ---------------------------------------------------------------- 마네킹
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

function smoothPath(pts: Pt[]): string {
  const n = pts.length
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}

/** 가는 선(a→b) 둘레에 반지름 r(t)로 부푼 팔·다리 윤곽 */
function limb(a: Pt, b: Pt, radii: [number, number][], u: number, tipK = 0.7): string {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const n: Pt = [-dy / len, dx / len]
  const left: Pt[] = [], right: Pt[] = []
  radii.forEach(([t, r]) => {
    const c = lerp(a, b, t)
    left.push([c[0] + n[0] * r * u, c[1] + n[1] * r * u])
    right.push([c[0] - n[0] * r * u, c[1] - n[1] * r * u])
  })
  const tip = (p: Pt, dir: number, r: number): Pt => [p[0] + (dx / len) * dir * r * u * tipK, p[1] + (dy / len) * dir * r * u * tipK]
  return smoothPath([tip(a, -1, radii[0][1]), ...left, tip(b, 1, radii[radii.length - 1][1]), ...right.reverse()])
}

function Figure({ geo }: { geo: Geo }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const { cx, top, height: Hp, u } = geo
  // 머리: 이마가 넓고 턱이 좁은 달걀형 하나
  const R = 0.039 * Hp, ry = 0.066 * Hp, hy = top + 0.067 * Hp
  const head: Pt[] = Array.from({ length: 44 }, (_, i) => {
    const th = (i / 44) * Math.PI * 2
    return [cx + R * Math.sin(th) * (1 + 0.2 * Math.cos(th)), hy - ry * Math.cos(th)]
  })
  const neckTop = hy + ry * 0.85
  const torso: Pt[] = []
  const side = (s: 1 | -1): Pt[] => [
    [cx + s * geo.neckHalf, geo.neckBase[1]],
    [cx + s * (geo.neckHalf + (geo.rSh[0] - cx - geo.neckHalf) * 0.55), geo.neckBase[1] + (geo.rSh[1] - geo.neckBase[1]) * 0.55],
    [cx + s * (geo.rSh[0] - cx + 2), geo.rSh[1] + 6],
    [cx + s * geo.chestHalf, geo.Y(0.272)],
    [cx + s * (geo.waistHalf + (geo.chestHalf - geo.waistHalf) * 0.3), geo.Y(0.32)],
    [cx + s * geo.waistHalf, geo.waistY],
    [cx + s * (geo.hipHalf * 0.97), geo.hipY],
    [cx + s * geo.hipHalf * 0.8, geo.crotchY - 6],
  ]
  torso.push(...side(1), [cx, geo.crotchY + 4], ...side(-1).reverse())
  const armR: [number, number][] = [[0, geo.armR / u], [0.22, 4.0], [0.5, 3.2], [0.74, 2.9], [1, 2.3]]
  const legR: [number, number][] = [[0, 8.2], [0.22, 7.4], [0.5, 5.2], [0.66, 4.8], [0.9, 3.1], [1, 2.6]]
  const legTop = (s: 1 | -1): Pt => [cx + s * geo.legX, geo.hipY - 10]
  const legBot = (s: 1 | -1): Pt => [cx + s * geo.legX * 0.92, geo.ankleY]
  const fill = `url(#${id}f)`
  const stroke = 'rgba(120,108,92,.35)'
  const hand = (w: Pt, s: 1 | -1) => (
    <ellipse cx={w[0] + s * 1.5 * u * 0.4} cy={w[1] + 4.6 * u} rx={1.7 * u} ry={5 * u} transform={`rotate(${s * -8} ${w[0]} ${w[1]})`} fill={fill} stroke={stroke} strokeWidth="0.8" />
  )
  return (
    <svg className="figure" viewBox={`0 0 ${geo.W} ${geo.H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9d3c8" />
          <stop offset="0.3" stopColor="#f2eee6" />
          <stop offset="0.7" stopColor="#f6f2eb" />
          <stop offset="1" stopColor="#d5cfc3" />
        </linearGradient>
        <radialGradient id={`${id}g`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e8e4db" />
          <stop offset="1" stopColor="#d6d1c5" />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={geo.floorY + 4} rx={0.38 * Hp * 0.62} ry="11" fill={`url(#${id}g)`} />
      <ellipse cx={cx} cy={geo.floorY + 2} rx={0.38 * Hp * 0.62 - 6} ry="7" fill="rgba(60,50,40,.12)" />
      {([1, -1] as const).map((s) => (
        <g key={s}>
          <path d={limb(legTop(s), legBot(s), legR, u)} fill={fill} stroke={stroke} strokeWidth="0.8" />
          <ellipse cx={cx + s * (geo.legX * 0.92 + 6)} cy={geo.floorY - 5} rx="15" ry="6" transform={`rotate(${s * 6} ${cx + s * geo.legX * 0.92} ${geo.floorY})`} fill={fill} stroke={stroke} strokeWidth="0.8" />
        </g>
      ))}
      <path d={`M${cx - geo.neckHalf * 0.62},${neckTop} L${cx - geo.neckHalf},${geo.neckBase[1] + 4} L${cx + geo.neckHalf},${geo.neckBase[1] + 4} L${cx + geo.neckHalf * 0.62},${neckTop}Z`} fill={fill} stroke={stroke} strokeWidth="0.8" />
      <path d={smoothPath(head)} fill={fill} stroke={stroke} strokeWidth="0.8" />
      <path d={smoothPath(torso)} fill={fill} stroke={stroke} strokeWidth="0.8" />
      {([1, -1] as const).map((s) => {
        const sh: Pt = [geo.cx + s * geo.armTop[0], geo.armTop[1]]
        const wr: Pt = s === 1 ? geo.rWrist : geo.lWrist
        return (
          <g key={s}>
            <path d={limb(sh, wr, armR, u, 0.25)} fill={fill} stroke={stroke} strokeWidth="0.8" />
            {hand(wr, s)}
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------- 스튜디오
const SCALE = 2.4

/** 고른 옷을 하의 → 원피스 → 상의 → 아우터 순서로 마네킹에 겹쳐 입힌다. fits는 사진 옷의 품·기장 */
export default function Studio2D({ picks, fits, zoom = 1 }: { picks: Picks; fits: Record<number, Fit>; zoom?: number }) {
  const geo = useMemo(() => geometry(), [])
  const arts = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLCanvasElement>(null)
  const dark = useDarkTone()
  const sBottom = useSprite('BOTTOM', picks.BOTTOM, arts)
  const sDress = useSprite('DRESS', picks.DRESS, arts)
  const sTop = useSprite('TOP', picks.TOP, arts)
  const sOuter = useSprite('OUTER', picks.OUTER, arts)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    cv.width = Math.round(geo.W * SCALE)
    cv.height = Math.round(geo.H * SCALE)
    const out = cv.getContext('2d')!
    out.clearRect(0, 0, cv.width, cv.height)
    const fitOf = (g: GarmentSummary | undefined): Fit => (g?.imageUrl && fits[g.id]) || DEFAULT_FIT
    const layers: [Sprite | null, Fit][] = [[sBottom, fitOf(picks.BOTTOM)], [sDress, fitOf(picks.DRESS)], [sTop, fitOf(picks.TOP)], [sOuter, fitOf(picks.OUTER)]]
    // 옷 한 벌씩 따로 그린 뒤 그림자와 함께 겹친다(작업 캔버스는 하나를 비워 가며 쓴다)
    const off = document.createElement('canvas')
    off.width = cv.width
    off.height = cv.height
    const ctx = off.getContext('2d')!
    for (const [sprite, fit] of layers) {
      if (!sprite) continue
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, off.width, off.height)
      ctx.scale(SCALE, SCALE)
      drawGarment(ctx, sprite, geo, fit)
      // 옷 아래에 부드러운 그림자를 깔아 몸에서 살짝 떠 보이게(밤 화면은 어두운 바탕과 갈리도록 옅은 빛)
      out.save()
      out.shadowColor = dark ? 'rgba(255,255,255,0.14)' : 'rgba(40,30,20,0.26)'
      out.shadowBlur = (dark ? 5 : 7) * SCALE
      out.shadowOffsetY = dark ? 0 : 2.5 * SCALE
      out.drawImage(off, 0, 0)
      out.restore()
    }
  }, [geo, sBottom, sDress, sTop, sOuter, picks, fits, dark])

  const names = LAYER_ORDER.filter((s) => picks[s]).map((s) => picks[s]!.name)
  return (
    <div className="stage2d" role="img" aria-label={names.length ? `마네킹: ${names.join(', ')}` : '빈 마네킹'}
      style={{ aspectRatio: `${geo.W} / ${geo.H}`, transform: `scale(${zoom})` }}>
      <Figure geo={geo} />
      <canvas ref={ref} className="garments" />
      {/* 일러스트 옷은 옷장 그림을 그대로 이미지로 바꿔 입힌다 */}
      <div ref={arts} hidden>
        {LAYER_ORDER.map((s) => {
          const g = picks[s]
          return g ? <ShapeArt key={`${s}${g.id}`} className={`art-${s}`} shape={lookOf(g, s).shape} hex={g.colorHex} size={ART_SIZE} /> : null
        })}
      </div>
    </div>
  )
}
