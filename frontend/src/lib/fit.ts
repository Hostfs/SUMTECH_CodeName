import type { PhotoKind, Points, Pt } from './cutout';
import type { Body } from '../data/outfits';

// 2D 앞모습 마네킹의 기준점과, 옷 사진을 그 몸에 맞춰 입히는 변형(워프).
// 생성형 AI로 옷을 새로 그리지 않고 사진의 픽셀을 그대로 늘이고 줄여 맞춘다.

/** 1cm 를 몇 단위로 그릴지 */
const U = 3.6;
const VIEW_W = 360;

export interface Geo {
  W: number;
  H: number;
  cx: number;
  u: number;
  top: number;
  height: number;
  Y: (f: number) => number;
  neckBase: Pt;
  neckHalf: number;
  lSh: Pt;
  rSh: Pt;
  lWrist: Pt;
  rWrist: Pt;
  chestHalf: number;
  waistY: number;
  waistHalf: number;
  hipY: number;
  hipHalf: number;
  crotchY: number;
  kneeY: number;
  ankleY: number;
  floorY: number;
  legX: number;
  /** 팔이 어깨에서 시작하는 중심 / 윗팔 반지름 / 팔 길이(어깨→손목) */
  armTop: [number, number];
  armR: number;
  armLen: number;
  /** 옷이 덮어야 하는 어깨 바깥 반너비 (팔 바깥 가장자리) */
  outerHalf: number;
}

/** 둘레(cm) → 타원 단면의 반너비(cm). rd 는 앞뒤/좌우 비율 */
const half = (c: number, rd: number) => c / (2 * Math.PI) / Math.sqrt((1 + rd * rd) / 2);

export function geometry(body: Body | null): Geo {
  const cm = body?.height ?? 170;
  const waist = body?.waist ?? cm * 0.4;
  const chest = body?.chest ?? cm * 0.5;
  const hip = Math.max(cm * 0.52, waist * 1.12);
  const shoulder = body?.shoulder ?? cm * 0.235;
  const top = 34;
  const height = cm * U;
  const floorY = top + height;
  const Y = (f: number) => top + f * height;
  const cx = VIEW_W / 2;
  const shHalf = (shoulder / 2) * U;
  const armLen = 0.285 * height;
  const a = (8 * Math.PI) / 180;
  const lSh: Pt = [cx - shHalf, Y(0.205)];
  const rSh: Pt = [cx + shHalf, Y(0.205)];
  const hipHalf = half(hip, 0.68) * U;
  const armR = 4.3 * U;
  const armTop = Math.max(0, shHalf - armR * 0.62);
  const armY = lSh[1] + 0.03 * height;
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
  };
}

// ---------------------------------------------------------------- 옷 스프라이트 (사진 또는 일러스트를 래스터로)
export interface Sprite {
  img: CanvasImageSource;
  w: number;
  h: number;
  points: Points;
  kind: PhotoKind;
  /** 일러스트 전용: 밑단이 닿을 키 비율(머리 끝=0, 바닥=1), 소매가 팔 길이의 몇 %까지 내려오는지 */
  hemAt?: number;
  sleeve?: number;
}
export interface Fit {
  width: number;
  length: number;
}
export const DEFAULT_FIT: Fit = { width: 1, length: 1 };

/** 일러스트(96×96)의 기준점. 사진이 없는 옷도 같은 방식으로 입힌다 */
const ART: Record<string, { kind: PhotoKind; p: Points; hemAt?: number; sleeve?: number }> = {
  tee: { kind: 'top', hemAt: 0.5, sleeve: 0.42, p: { neck: [48, 15], lShoulder: [18, 20], rShoulder: [78, 20], lCuff: [12, 43], rCuff: [84, 43], hem: [48, 84] } },
  knit: { kind: 'top', hemAt: 0.5, sleeve: 1, p: { neck: [48, 15], lShoulder: [20, 18], rShoulder: [76, 18], lCuff: [15, 66], rCuff: [81, 66], hem: [48, 84] } },
  shirt: { kind: 'top', hemAt: 0.52, sleeve: 1, p: { neck: [48, 15], lShoulder: [20, 18], rShoulder: [76, 18], lCuff: [15, 66], rCuff: [81, 66], hem: [48, 86] } },
  blazer: { kind: 'outer', hemAt: 0.56, sleeve: 1, p: { neck: [48, 14], lShoulder: [18, 18], rShoulder: [78, 18], lCuff: [13, 67], rCuff: [83, 67], hem: [48, 78] } },
  coat: { kind: 'outer', hemAt: 0.7, sleeve: 1, p: { neck: [48, 14], lShoulder: [18, 18], rShoulder: [78, 18], lCuff: [13, 67], rCuff: [83, 67], hem: [48, 92] } },
  puffer: { kind: 'outer', hemAt: 0.58, sleeve: 1, p: { neck: [48, 15], lShoulder: [18, 18], rShoulder: [78, 18], lCuff: [13, 64], rCuff: [83, 64], hem: [48, 86] } },
  pants: { kind: 'bottom', hemAt: 0.955, p: { lWaist: [28, 8], rWaist: [68, 8], hem: [48, 90] } },
  shorts: { kind: 'bottom', hemAt: 0.7, p: { lWaist: [28, 20], rWaist: [68, 20], hem: [48, 64] } },
  skirt: { kind: 'bottom', hemAt: 0.7, p: { lWaist: [33, 16], rWaist: [63, 16], hem: [48, 82] } },
  pleated: { kind: 'bottom', hemAt: 0.72, p: { lWaist: [33, 16], rWaist: [63, 16], hem: [48, 82] } },
  sneaker: { kind: 'shoes', p: { hem: [48, 74] } },
  loafer: { kind: 'shoes', p: { hem: [48, 74] } },
  boots: { kind: 'shoes', p: { hem: [48, 78] } },
};
export const ART_SIZE = 384;
export function artSprite(shape: string, img: CanvasImageSource): Sprite {
  const a = ART[shape] ?? ART.tee;
  const k = ART_SIZE / 96;
  const points: Points = {};
  for (const [name, [x, y]] of Object.entries(a.p)) points[name] = [x * k, y * k];
  return { img, w: ART_SIZE, h: ART_SIZE, points, kind: a.kind, hemAt: a.hemAt, sleeve: a.sleeve };
}

// ---------------------------------------------------------------- 변형
/** 어깨 바깥 가장자리(팔 끝) 대비 품. 겉옷은 안에 입은 옷 위로 넉넉하게 */
const BASE_WIDTH: Record<PhotoKind, number> = { top: 1, outer: 1.12, bottom: 1.02, shoes: 1 };
/** 사진 속 옷 길이가 지나치게 길 때 밑단이 내려갈 수 있는 한계(키 비율) */
const MAX_HEM: Record<PhotoKind, number> = { top: 0.56, outer: 0.78, bottom: 0.975, shoes: 1 };

interface Anchor { s: Pt; r: Pt }

/** 기준점마다 어긋난 만큼(r)을 주변에 거리 반비례로 퍼뜨린다 (Shepard). 기준점 위에서는 정확히 맞는다 */
function spread(p: Pt, anchors: Anchor[]): Pt {
  let sx = 0, sy = 0, sw = 0;
  for (const a of anchors) {
    const dx = p[0] - a.s[0], dy = p[1] - a.s[1];
    const d2 = dx * dx + dy * dy;
    if (d2 < 1e-6) return a.r;
    const w = 1 / (d2 * Math.sqrt(d2));
    sx += w * a.r[0]; sy += w * a.r[1]; sw += w;
  }
  return [sx / sw, sy / sw];
}

/** 사진 좌표 → 마네킹 좌표 */
export function makeWarp(sprite: Sprite, geo: Geo, fit: Fit): (p: Pt) => Pt {
  const P = sprite.points;
  if (sprite.kind === 'bottom' && P.lWaist && P.rWaist) {
    const srcW = Math.max(10, P.rWaist[0] - P.lWaist[0]);
    const k = (geo.hipHalf * 2 * BASE_WIDTH.bottom * fit.width) / srcW;
    const midX = (P.lWaist[0] + P.rWaist[0]) / 2;
    const yTop = (P.lWaist[1] + P.rWaist[1]) / 2;
    const dstTop = geo.waistY + 0.28 * (geo.hipY - geo.waistY);
    const hemSrc = P.hem?.[1] ?? sprite.h;
    // 밑단 위치: 일러스트는 정해진 길이로, 사진은 비율 그대로 두되 발목 아래로 내려가지 않게
    let hemDst = dstTop + (hemSrc - yTop) * k * fit.length;
    if (sprite.hemAt != null) hemDst = geo.Y(sprite.hemAt) * fit.length + (1 - fit.length) * dstTop;
    hemDst = Math.min(hemDst, geo.Y(MAX_HEM.bottom));
    const ky = (hemDst - dstTop) / Math.max(10, hemSrc - yTop);
    return (p) => [geo.cx + (p[0] - midX) * k, dstTop + (p[1] - yTop) * ky];
  }
  if ((sprite.kind === 'top' || sprite.kind === 'outer') && P.neck && P.lShoulder && P.rShoulder) {
    const sSrc = Math.max(10, P.rShoulder[0] - P.lShoulder[0]);
    const sDst = 2 * (geo.outerHalf + 2) * BASE_WIDTH[sprite.kind] * fit.width;
    const kx = sDst / sSrc;
    const ky = kx * fit.length;
    const midX = (P.lShoulder[0] + P.rShoulder[0]) / 2;
    const neckDst: Pt = [geo.cx, geo.neckBase[1] - 7];
    const base = (p: Pt): Pt => [geo.cx + (p[0] - midX) * kx, neckDst[1] + (p[1] - P.neck[1]) * ky];

    const hemSrc = P.hem?.[1] ?? sprite.h;
    const want = (src: Pt, dst: Pt): Anchor => {
      const b = base(src);
      return { s: src, r: [dst[0] - b[0], dst[1] - b[1]] };
    };
    // 밑단: 일러스트는 정해진 길이, 사진은 비율 그대로 두되 너무 길면 한계에서 멈춘다
    const hemNat = base([midX, hemSrc])[1];
    let hemDst = sprite.hemAt != null ? geo.Y(sprite.hemAt) + (fit.length - 1) * (geo.crotchY - neckDst[1]) * 0.5 : hemNat;
    hemDst = Math.min(hemDst, geo.Y(MAX_HEM[sprite.kind]));
    const dHem = hemDst - hemNat;
    const hemPin = (x: number, y: number): Anchor => ({ s: [x, y], r: [0, dHem] });
    const pin = (x: number, y: number): Anchor => ({ s: [x, y], r: [0, 0] });
    const sh = P.rShoulder[0] - P.lShoulder[0];
    const anchors: Anchor[] = [
      pin(P.neck[0], P.neck[1]),
      want(P.lShoulder, [geo.cx - sDst / 2, geo.lSh[1] + 2]),
      want(P.rShoulder, [geo.cx + sDst / 2, geo.rSh[1] + 2]),
      hemPin(midX, hemSrc),
      hemPin(P.lShoulder[0] + 0.1 * sh, hemSrc),
      hemPin(P.rShoulder[0] - 0.1 * sh, hemSrc),
      { s: [midX, (P.lShoulder[1] + hemSrc) / 2], r: [0, dHem / 2] },
      { s: [P.lShoulder[0] + 0.14 * sh, (P.lShoulder[1] + hemSrc) / 2], r: [0, dHem / 2] },
      { s: [P.rShoulder[0] - 0.14 * sh, (P.lShoulder[1] + hemSrc) / 2], r: [0, dHem / 2] },
    ];
    // 소매: 사진 속 소매를 하나의 덩어리로 보고, 어깨 솔기를 축으로 돌려 마네킹 팔 축에 눕힌다.
    // 길이는 손목 위에서 멈추고(손이 가려지지 않게), 길면 소매 전체를 같은 비율로 줄여 폭도 같이 날씬해진다.
    const sleeves: ((p: Pt) => { w: number; q: Pt })[] = [];
    if (P.lCuff && P.rCuff) {
      for (const s of [-1, 1] as const) {
        const cuff = s === -1 ? P.lCuff : P.rCuff;
        const S = s === -1 ? P.lShoulder : P.rShoulder;
        const D0: Pt = [geo.cx + s * sDst / 2, (s === -1 ? geo.lSh[1] : geo.rSh[1]) + 2];
        const o: Pt = [geo.cx + s * geo.armTop[0], geo.armTop[1]];
        const wr: Pt = s === -1 ? geo.lWrist : geo.rWrist;
        const full = Math.hypot(wr[0] - o[0], wr[1] - o[1]);
        const dir: Pt = [(wr[0] - o[0]) / full, (wr[1] - o[1]) / full];
        const maxLen = full - 1.6 * geo.u;
        const natLen = Math.hypot(cuff[0] - S[0], cuff[1] - S[1]) || 1;
        const want2 = sprite.sleeve != null ? full * sprite.sleeve : natLen * kx;
        const len = Math.min(maxLen, want2 * fit.length);
        const C: Pt = [o[0] + dir[0] * len, o[1] + dir[1] * len];
        const dl = Math.hypot(C[0] - D0[0], C[1] - D0[1]) || 1;
        const ks = dl / natLen;
        const th = Math.atan2(C[1] - D0[1], C[0] - D0[0]) - Math.atan2(cuff[1] - S[1], cuff[0] - S[0]);
        const ca = ks * Math.cos(th), sa = ks * Math.sin(th);
        const ramp = (v: number) => { const t = Math.min(1, Math.max(0, v)); return t * t * (3 - 2 * t); };
        sleeves.push((p) => {
          const vx = p[0] - S[0], vy = p[1] - S[1];
          const d = s === -1 ? S[0] + 0.14 * sh - p[0] : p[0] - (S[0] - 0.14 * sh);
          const wx = ramp(d / (0.2 * sh));
          const wy = ramp((p[1] - (S[1] - 0.05 * sh)) / (0.1 * sh));
          return { w: wx * wy, q: [D0[0] + ca * vx - sa * vy, D0[1] + sa * vx + ca * vy] };
        });
      }
    }
    return (p) => {
      const b = base(p);
      const d = spread(p, anchors);
      let r: Pt = [b[0] + d[0], b[1] + d[1]];
      for (const f of sleeves) {
        const { w, q } = f(p);
        if (w > 0) r = [r[0] * (1 - w) + q[0] * w, r[1] * (1 - w) + q[1] * w];
      }
      return r;
    };
  }
  // 기준점이 없으면 가슴 높이에 폭만 맞춘다
  const k = (geo.hipHalf * 2) / sprite.w;
  return (p) => [geo.cx + (p[0] - sprite.w / 2) * k, geo.hipY + p[1] * k];
}

// ---------------------------------------------------------------- 그리기
function triangle(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s: Pt[], d: Pt[]) {
  const det = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1]);
  if (Math.abs(det) < 1e-6) return;
  const a = ((d[1][0] - d[0][0]) * (s[2][1] - s[0][1]) - (d[2][0] - d[0][0]) * (s[1][1] - s[0][1])) / det;
  const c = ((d[2][0] - d[0][0]) * (s[1][0] - s[0][0]) - (d[1][0] - d[0][0]) * (s[2][0] - s[0][0])) / det;
  const b = ((d[1][1] - d[0][1]) * (s[2][1] - s[0][1]) - (d[2][1] - d[0][1]) * (s[1][1] - s[0][1])) / det;
  const e2 = ((d[2][1] - d[0][1]) * (s[1][0] - s[0][0]) - (d[1][1] - d[0][1]) * (s[2][0] - s[0][0])) / det;
  const e = d[0][0] - a * s[0][0] - c * s[0][1];
  const f = d[0][1] - b * s[0][0] - e2 * s[0][1];
  // 삼각형 사이 실선이 비치지 않도록 클립을 0.7 만큼 바깥으로 넓힌다
  const g: Pt = [(d[0][0] + d[1][0] + d[2][0]) / 3, (d[0][1] + d[1][1] + d[2][1]) / 3];
  ctx.save();
  ctx.beginPath();
  d.forEach((p, i) => {
    const dx = p[0] - g[0], dy = p[1] - g[1];
    const l = Math.hypot(dx, dy) || 1;
    const q: Pt = [p[0] + (dx / l) * 0.7, p[1] + (dy / l) * 0.7];
    if (i === 0) ctx.moveTo(q[0], q[1]);
    else ctx.lineTo(q[0], q[1]);
  });
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, e2, e, f);
  const x0 = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0]) - 1));
  const y0 = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1]) - 1));
  const x1 = Math.ceil(Math.max(s[0][0], s[1][0], s[2][0]) + 1);
  const y1 = Math.ceil(Math.max(s[0][1], s[1][1], s[2][1]) + 1);
  ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

/** 사진을 격자로 쪼개 각 점을 워프한 위치로 옮겨 그린다 */
export function drawGarment(ctx: CanvasRenderingContext2D, sprite: Sprite, geo: Geo, fit: Fit) {
  if (sprite.kind === 'shoes') {
    // 신발: 바닥에 두 짝. 옆모습 사진이 많아 왼쪽은 뒤집어 발끝이 바깥을 향하게 한다.
    // 사진 아래쪽 여백(밑창 아래)은 빼고 밑창이 바닥에 닿게 한다.
    const k = (0.125 * geo.height) / sprite.w;
    const dw = sprite.w * k * fit.width, dh = sprite.h * k * fit.width;
    const sole = ((sprite.points.hem?.[1] ?? sprite.h) / sprite.h) * dh;
    const ankleX = geo.legX * 0.92;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(geo.cx + side * ankleX, geo.floorY);
      ctx.scale(side, 1);
      // 발목이 신발 길이의 앞쪽 1/3 지점 위에 오도록
      ctx.drawImage(sprite.img, -dw * 0.22, -sole, dw, dh);
      ctx.restore();
    }
    return;
  }
  const warp = makeWarp(sprite, geo, fit);
  const cols = 14, rows = 18;
  const grid: { s: Pt; d: Pt }[][] = [];
  for (let r = 0; r <= rows; r++) {
    const line: { s: Pt; d: Pt }[] = [];
    for (let c = 0; c <= cols; c++) {
      const s: Pt = [(c / cols) * sprite.w, (r / rows) * sprite.h];
      line.push({ s, d: warp(s) });
    }
    grid.push(line);
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = grid[r][c], b = grid[r][c + 1], d = grid[r + 1][c], e = grid[r + 1][c + 1];
      triangle(ctx, sprite.img, [a.s, b.s, d.s], [a.d, b.d, d.d]);
      triangle(ctx, sprite.img, [b.s, e.s, d.s], [b.d, e.d, d.d]);
    }
  }
}
