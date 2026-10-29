import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GarmentArt } from './GarmentArt';
import { useImages } from '../data/images';
import type { Garment } from '../data/garments';
import type { Body } from '../data/outfits';
import type { Pt } from '../lib/cutout';
import { ART_SIZE, DEFAULT_FIT, artSprite, drawGarment, geometry, type Geo, type Sprite } from '../lib/fit';

// 2D 앞모습 마네킹 + 옷 사진을 몸에 맞춰 입히는 캔버스.
// 사진이 있는 옷은 누끼 PNG 를, 없는 옷은 일러스트를 같은 방식으로 입힌다.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 읽지 못했어요'));
    img.src = src;
  });
}

/** 옷 하나를 그릴 수 있는 형태(사진 또는 일러스트 스프라이트)로 준비한다 */
export function useSprite(g: Garment | null): Sprite | null {
  const { urls } = useImages();
  const [sprite, setSprite] = useState<Sprite | null>(null);
  const url = g?.photo ? (g.photo.src.startsWith('idb:') ? urls[g.photo.src.slice(4)] : g.photo.src) : null;
  const key = g ? `${g.id}|${g.photo ? `${url}|${JSON.stringify(g.photo.points)}` : `${g.shape}${g.hex}`}` : '';

  useEffect(() => {
    let alive = true;
    if (!g) {
      setSprite(null);
      return;
    }
    (async () => {
      try {
        if (g.photo) {
          if (!url) return;
          const img = await loadImage(url);
          if (alive) setSprite({ img, w: img.naturalWidth, h: img.naturalHeight, points: g.photo.points, kind: g.photo.kind });
        } else {
          const svg = renderToStaticMarkup(<GarmentArt shape={g.shape} hex={g.hex} size={ART_SIZE} />);
          const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
          if (alive) setSprite(artSprite(g.shape, img));
        }
      } catch {
        if (alive) setSprite(null);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return sprite;
}

// ---------------------------------------------------------------- 마네킹
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function smoothPath(pts: Pt[]): string {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

/** 가는 선(a→b) 둘레에 반지름 r(t)로 부푼 팔·다리 윤곽 */
function limb(a: Pt, b: Pt, radii: [number, number][], u: number, tipK = 0.7): string {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const n: Pt = [-dy / len, dx / len];
  const left: Pt[] = [], right: Pt[] = [];
  radii.forEach(([t, r]) => {
    const c = lerp(a, b, t);
    left.push([c[0] + n[0] * r * u, c[1] + n[1] * r * u]);
    right.push([c[0] - n[0] * r * u, c[1] - n[1] * r * u]);
  });
  const tip = (p: Pt, dir: number, r: number): Pt => [p[0] + (dx / len) * dir * r * u * tipK, p[1] + (dy / len) * dir * r * u * tipK];
  return smoothPath([tip(a, -1, radii[0][1]), ...left, tip(b, 1, radii[radii.length - 1][1]), ...right.reverse()]);
}

function Figure({ geo }: { geo: Geo }) {
  const id = useId().replace(/:/g, '');
  const { cx, top, height: Hp, u } = geo;
  // 머리: 이마가 넓고 턱이 좁은 달걀형 하나
  const R = 0.039 * Hp, ry = 0.066 * Hp, hy = top + 0.067 * Hp;
  const head: Pt[] = Array.from({ length: 44 }, (_, i) => {
    const th = (i / 44) * Math.PI * 2;
    return [cx + R * Math.sin(th) * (1 + 0.2 * Math.cos(th)), hy - ry * Math.cos(th)];
  });
  const neckTop = hy + ry * 0.85;
  const torso: Pt[] = [];
  const side = (s: 1 | -1): Pt[] => [
    [cx + s * geo.neckHalf, geo.neckBase[1]],
    [cx + s * (geo.neckHalf + (geo.rSh[0] - cx - geo.neckHalf) * 0.55), geo.neckBase[1] + (geo.rSh[1] - geo.neckBase[1]) * 0.55],
    [cx + s * (geo.rSh[0] - cx + 2), geo.rSh[1] + 6],
    [cx + s * geo.chestHalf, geo.Y(0.272)],
    [cx + s * (geo.waistHalf + (geo.chestHalf - geo.waistHalf) * 0.3), geo.Y(0.32)],
    [cx + s * geo.waistHalf, geo.waistY],
    [cx + s * (geo.hipHalf * 0.97), geo.hipY],
    [cx + s * geo.hipHalf * 0.8, geo.crotchY - 6],
  ];
  torso.push(...side(1), [cx, geo.crotchY + 4], ...side(-1).reverse());
  const armR: [number, number][] = [[0, geo.armR / u], [0.22, 4.0], [0.5, 3.2], [0.74, 2.9], [1, 2.3]];
  const legR: [number, number][] = [[0, 8.2], [0.22, 7.4], [0.5, 5.2], [0.66, 4.8], [0.9, 3.1], [1, 2.6]];
  const legTop = (s: 1 | -1): Pt => [cx + s * geo.legX, geo.hipY - 10];
  const legBot = (s: 1 | -1): Pt => [cx + s * geo.legX * 0.92, geo.ankleY];
  const kneeT = (geo.kneeY - (geo.hipY - 10)) / (geo.ankleY - (geo.hipY - 10));
  const legRadii = legR.map(([t, r]) => [t, r] as [number, number]).sort((a, b) => a[0] - b[0]);
  void kneeT;
  const fill = `url(#${id}f)`;
  const stroke = 'rgba(120,108,92,.35)';
  const hand = (w: Pt, s: 1 | -1): JSX.Element => (
    <ellipse cx={w[0] + s * 1.5 * u * 0.4} cy={w[1] + 4.6 * u} rx={1.7 * u} ry={5 * u} transform={`rotate(${s * -8} ${w[0]} ${w[1]})`} fill={fill} stroke={stroke} strokeWidth="0.8" />
  );
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
          <path d={limb(legTop(s), legBot(s), legRadii, u)} fill={fill} stroke={stroke} strokeWidth="0.8" />
          <ellipse cx={cx + s * (geo.legX * 0.92 + 6)} cy={geo.floorY - 5} rx="15" ry="6" transform={`rotate(${s * 6} ${cx + s * geo.legX * 0.92} ${geo.floorY})`} fill={fill} stroke={stroke} strokeWidth="0.8" />
        </g>
      ))}
      <path d={`M${cx - geo.neckHalf * 0.62},${neckTop} L${cx - geo.neckHalf},${geo.neckBase[1] + 4} L${cx + geo.neckHalf},${geo.neckBase[1] + 4} L${cx + geo.neckHalf * 0.62},${neckTop}Z`} fill={fill} stroke={stroke} strokeWidth="0.8" />
      <path d={smoothPath(head)} fill={fill} stroke={stroke} strokeWidth="0.8" />
      <path d={smoothPath(torso)} fill={fill} stroke={stroke} strokeWidth="0.8" />
      {([1, -1] as const).map((s) => {
        const sh: Pt = [geo.cx + s * geo.armTop[0], geo.armTop[1]];
        const wr: Pt = s === 1 ? geo.rWrist : geo.lWrist;
        return (
          <g key={s}>
            <path d={limb(sh, wr, armR, u, 0.25)} fill={fill} stroke={stroke} strokeWidth="0.8" />
            {hand(wr, s)}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------- 스튜디오
interface Props {
  body: Body | null;
  outer: Garment | null;
  top: Garment | null;
  bottom: Garment | null;
  shoes: Garment | null;
  zoom?: number;
}

const SCALE = 2.4;

export function Studio2D({ body, outer, top, bottom, shoes, zoom = 1 }: Props) {
  const geo = useMemo(() => geometry(body), [body]);
  const sOuter = useSprite(outer);
  const sTop = useSprite(top);
  const sBottom = useSprite(bottom);
  const sShoes = useSprite(shoes);
  const ref = useRef<HTMLCanvasElement>(null);

  const fitOf = (g: Garment | null) => g?.photo?.fit ?? DEFAULT_FIT;
  const fits = [outer, top, bottom, shoes].map((g) => `${fitOf(g).width}/${fitOf(g).length}`).join('|');

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = Math.round(geo.W * SCALE);
    cv.height = Math.round(geo.H * SCALE);
    const out = cv.getContext('2d')!;
    out.clearRect(0, 0, cv.width, cv.height);
    const layers: [Sprite | null, Garment | null][] = [[sShoes, shoes], [sBottom, bottom], [sTop, top], [sOuter, outer]];
    for (const [sprite, g] of layers) {
      if (!sprite) continue;
      const off = document.createElement('canvas');
      off.width = cv.width;
      off.height = cv.height;
      const ctx = off.getContext('2d')!;
      ctx.scale(SCALE, SCALE);
      drawGarment(ctx, sprite, geo, fitOf(g));
      // 옷 아래에 부드러운 그림자를 깔아 몸에서 살짝 떠 보이게
      out.save();
      out.shadowColor = 'rgba(40,30,20,0.26)';
      out.shadowBlur = 7 * SCALE;
      out.shadowOffsetY = 2.5 * SCALE;
      out.drawImage(off, 0, 0);
      out.restore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, sOuter, sTop, sBottom, sShoes, fits]);

  return (
    <div className="stage2d" style={{ aspectRatio: `${geo.W} / ${geo.H}`, transform: `scale(${zoom})` }}>
      <Figure geo={geo} />
      <canvas ref={ref} className="garments" />
    </div>
  );
}
