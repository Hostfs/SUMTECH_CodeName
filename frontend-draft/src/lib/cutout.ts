// 옷 사진 → 누끼(옷만 남기기) → 핏을 맞출 기준점(랜드마크) 찾기.
// 전부 브라우저 안에서 돈다. 생성형 AI로 옷을 '그려 내지' 않고 사진의 픽셀을 그대로 쓰므로 없는 디테일이 생기지 않는다.

export type PhotoKind = 'top' | 'outer' | 'bottom' | 'shoes';
export type Pt = [number, number];
/** 키: 상의·아우터 neck lShoulder rShoulder lCuff rCuff hem / 하의 lWaist rWaist hem */
export type Points = Record<string, Pt>;
export type CutMode = 'flat' | 'person';

export interface Cutout {
  canvas: HTMLCanvasElement;
  kind: PhotoKind;
  mode: CutMode;
  points: Points;
  /** 자동 추정 색 */
  hex: string;
}

type Progress = (message: string) => void;

// ------------------------------------------------------------------ 불러오기
export async function loadCanvas(src: string | Blob, maxSide = 1000): Promise<HTMLCanvasElement> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url);
  }
}

const pix = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);

// ------------------------------------------------------------------ 마스크 도구
/** 8방향 연결 성분 중 가장 큰 것만 남긴다 */
function keepLargest(mask: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || label[i]) continue;
    next++;
    let size = 0;
    stack.push(i);
    label[i] = next;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (mask[q] && !label[q]) {
            label[q] = next;
            stack.push(q);
          }
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = label[i] === best ? 1 : 0;
  return out;
}

/** 상자 모양 팽창/침식 (가로·세로 분리). erode 는 이미지 밖을 옷으로 본다 */
function boxFilter(mask: Uint8Array, w: number, h: number, r: number, mode: 'dilate' | 'erode'): Uint8Array {
  const tmp: Uint8Array = new Uint8Array(w * h);
  const out: Uint8Array = new Uint8Array(w * h);
  const pass = (src: Uint8Array, dst: Uint8Array, len: number, stride: number, lines: number, lineStride: number) => {
    const pre = new Int32Array(len + 1);
    for (let l = 0; l < lines; l++) {
      const base = l * lineStride;
      for (let i = 0; i < len; i++) pre[i + 1] = pre[i] + src[base + i * stride];
      for (let i = 0; i < len; i++) {
        const a = Math.max(0, i - r);
        const b = Math.min(len - 1, i + r);
        const sum = pre[b + 1] - pre[a];
        if (mode === 'dilate') dst[base + i * stride] = sum > 0 ? 1 : 0;
        else dst[base + i * stride] = sum + (2 * r + 1 - (b - a + 1)) >= 2 * r + 1 ? 1 : 0;
      }
    }
  };
  pass(mask, tmp, w, 1, h, w);
  pass(tmp, out, h, w, w, 1);
  return out;
}

/** 가장자리를 1px 부드럽게 (톱니 제거) */
function feather(mask: Uint8Array, w: number, h: number, radius = 1): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h);
  const area = (2 * radius + 1) ** 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(w - 1, Math.max(0, x + dx));
          const ny = Math.min(h - 1, Math.max(0, y + dy));
          sum += mask[ny * w + nx];
        }
      }
      out[y * w + x] = Math.round((sum / area) * 255);
    }
  }
  return out;
}

/** 마스크를 알파로 입혀 옷만 남기고 여백을 잘라 낸다 */
function applyMask(src: HTMLCanvasElement, mask: Uint8Array): HTMLCanvasElement {
  const { width: w, height: h } = src;
  const alpha = feather(mask, w, h, 1);
  const data = pix(src);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      data.data[i * 4 + 3] = alpha[i];
      if (alpha[i] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const full = document.createElement('canvas');
  full.width = w;
  full.height = h;
  full.getContext('2d')!.putImageData(data, 0, 0);
  if (x1 <= x0 || y1 <= y0) return full;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
  const cx0 = Math.max(0, x0 - pad);
  const cy0 = Math.max(0, y0 - pad);
  const cw = Math.min(w, x1 + pad + 1) - cx0;
  const ch = Math.min(h, y1 + pad + 1) - cy0;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')!.drawImage(full, cx0, cy0, cw, ch, 0, 0, cw, ch);
  return out;
}

// ------------------------------------------------------------------ ① 배경만 있는 사진 (고정 배경 제거)
export interface FlatResult { mask: Uint8Array; plain: boolean; fraction: number; skin: number }

export function flatBackgroundMask(c: HTMLCanvasElement, tolerance: number, fillHoles = true): FlatResult {
  const { width: w, height: h } = c;
  const d = pix(c).data;
  // 가장자리 색의 중앙값을 배경색으로 본다
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]);
  };
  for (let x = 0; x < w; x++) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y++) { take(0, y); take(w - 1, y); }
  const med = (a: number[]) => [...a].sort((p, q) => p - q)[a.length >> 1];
  const bg = [med(rs), med(gs), med(bs)];
  const spread = rs.reduce((s, v, i) => s + Math.abs(v - bg[0]) + Math.abs(gs[i] - bg[1]) + Math.abs(bs[i] - bg[2]), 0) / (rs.length * 3);

  const near = (i: number) => {
    const dr = d[i * 4] - bg[0], dg = d[i * 4 + 1] - bg[1], db = d[i * 4 + 2] - bg[2];
    return Math.sqrt(dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.9) < tolerance;
  };
  const isBg = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const i = y * w + x;
    if (!isBg[i] && near(i)) { isBg[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }
  let mask: Uint8Array = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = isBg[i] ? 0 : 1;
  mask = keepLargest(mask, w, h);

  // 팔과 몸통 사이처럼 배경이 안쪽에 갇힌 구멍도 지운다 (배경색과 비슷하고 어느 정도 넓은 것만)
  const seen = new Uint8Array(w * h);
  const minHole = w * h * 0.002;
  for (let i = 0; i < mask.length; i++) {
    if (!fillHoles || !mask[i] || seen[i] || !near(i)) continue;
    const comp: number[] = [];
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      comp.push(p);
      const x = p % w, y = (p / w) | 0;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (mask[q] && !seen[q] && near(q)) { seen[q] = 1; stack.push(q); }
      }
    }
    if (comp.length > minHole) for (const p of comp) mask[p] = 0;
  }

  let count = 0, skin = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    count++;
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    // 피부색(대략): R>G>B, 밝기 중간 이상, 채도 낮지 않음
    if (r > 95 && g > 40 && b > 20 && r > g && g > b && r - b > 25 && r - g > 8 && r - g < 90) skin++;
  }
  return { mask, plain: spread < 22, fraction: count / mask.length, skin: count ? skin / count : 0 };
}

// ------------------------------------------------------------------ ② 사람이 입은 사진 (의류 분할 모델)
// SegFormer(clothes) — 상의·바지·신발·피부를 구분하므로 바지 사진에서 신발과 맨살을 뺄 수 있다.
const LABELS: Record<PhotoKind, string[]> = {
  top: ['Upper-clothes', 'Dress'],
  outer: ['Upper-clothes'],
  bottom: ['Pants', 'Skirt', 'Belt', 'Bag'],
  shoes: ['Left-shoe', 'Right-shoe'],
};
const PERSON_LABELS = ['Face', 'Hair', 'Left-arm', 'Right-arm', 'Left-leg', 'Right-leg'];
// 옷으로 잘못 섞이면 안 되는 부위. 팔·상의 등은 모델이 주머니·지퍼를 잘못 보는 일이 잦아 색으로만 판정한다.
const HARD_EXCLUDE = ['Left-shoe', 'Right-shoe', 'Left-leg', 'Right-leg', 'Face', 'Hair'];

interface Segmenter { (input: string): Promise<{ label: string; mask: { data: Uint8Array | Uint8ClampedArray; width: number; height: number } }[]> }
let segmenter: Promise<Segmenter> | null = null;

function getSegmenter(onProgress?: Progress): Promise<Segmenter> {
  segmenter ??= (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    onProgress?.('옷 분할 모델을 불러오는 중이에요 (처음 한 번만, 약 29MB)');
    const seg = await pipeline('image-segmentation', 'Xenova/segformer_b2_clothes', {
      dtype: 'q8',
      progress_callback: (p: { status?: string; progress?: number }) => {
        if (p.status === 'progress' && typeof p.progress === 'number') onProgress?.(`옷 분할 모델 내려받는 중… ${Math.round(p.progress)}%`);
      },
    });
    return seg as unknown as Segmenter;
  })().catch((e) => {
    segmenter = null;
    throw e;
  });
  return segmenter;
}

export interface PersonResult { mask: Uint8Array; person: number; found: number }

/** 밝기순으로 고른 시작점에서 출발하는 간단한 k-평균 (RGB) */
function kmeans(px: number[][], k: number): number[][] {
  if (px.length <= k) return px;
  const sorted = [...px].sort((p, q) => p[0] + p[1] + p[2] - (q[0] + q[1] + q[2]));
  let C = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / k)].slice());
  for (let it = 0; it < 8; it++) {
    const sums = C.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = (p[0] - C[c][0]) ** 2 + (p[1] - C[c][1]) ** 2 + (p[2] - C[c][2]) ** 2;
        if (dd < bd) { bd = dd; bi = c; }
      }
      sums[bi][0] += p[0]; sums[bi][1] += p[1]; sums[bi][2] += p[2]; sums[bi][3]++;
    }
    C = C.map((c, i) => (sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : c));
  }
  return C;
}

/** 실수 배열 상자 흐림 (가로·세로 분리) */
function blurFloat(a: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const pass = (src: Float32Array, dst: Float32Array, len: number, stride: number, lines: number, lineStride: number) => {
    const pre = new Float64Array(len + 1);
    for (let l = 0; l < lines; l++) {
      const base = l * lineStride;
      for (let i = 0; i < len; i++) pre[i + 1] = pre[i] + src[base + i * stride];
      for (let i = 0; i < len; i++) {
        const lo = Math.max(0, i - r);
        const hi = Math.min(len - 1, i + r);
        dst[base + i * stride] = (pre[hi + 1] - pre[lo]) / (hi - lo + 1);
      }
    }
  };
  pass(a, tmp, w, 1, h, w);
  pass(tmp, out, h, w, w, 1);
  return out;
}

/**
 * 분할 모델의 마스크는 거칠어서(주머니·가장자리를 놓치고 계단 모양이 된다) 최종 윤곽으로 쓰지 않는다.
 * 모델 결과는 '옷 색'과 '배경 색'을 뽑는 씨앗으로만 쓰고, 그 사이 넓은 경계 띠를 픽셀마다 어느 쪽 색에 가까운지로 다시 판정한다.
 * 신발·피부 등 다른 부위로 인식된 곳은 옷에서 강제로 제외한다.
 */
function refineWithColors(c: HTMLCanvasElement, wanted: Uint8Array, hard: Uint8Array): Uint8Array {
  const { width: w, height: h } = c;
  const d = pix(c).data;
  const band = Math.max(12, Math.round(Math.max(w, h) * 0.09));
  const sure = boxFilter(wanted, w, h, 5, 'erode');
  const near = boxFilter(wanted, w, h, band, 'dilate');
  const forcedBg = boxFilter(hard, w, h, 3, 'dilate');

  const fg: number[][] = [], bg: number[][] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 6000)));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = y * w + x;
      const px = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
      if (sure[i]) fg.push(px);
      else if (!near[i]) bg.push(px);
    }
  }
  if (fg.length < 20) return wanted;
  if (bg.length < 40) {
    // 배경이 거의 안 보이는 사진이면 가장자리 색을 쓴다
    for (let x = 0; x < w; x += step) for (const y of [0, h - 1]) { const i = y * w + x; if (!wanted[i]) bg.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]); }
    for (let y = 0; y < h; y += step) for (const x of [0, w - 1]) { const i = y * w + x; if (!wanted[i]) bg.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]); }
  }
  // 옷 안쪽 픽셀 중 가장 밝은 쪽보다 확실히 더 밝은 것은 바닥·벽 조각으로 본다
  const lumOf = (r: number, g: number, b: number) => r * 0.3 + g * 0.59 + b * 0.11;
  const lums = fg.map((p) => lumOf(p[0], p[1], p[2])).sort((p, q) => p - q);
  const brightLimit = lums[Math.min(lums.length - 1, Math.floor(lums.length * 0.985))] + 30;
  const fgC = kmeans(fg, 3);
  const bgC = bg.length ? kmeans(bg, 4) : [[255, 255, 255]];
  const nearest = (i: number, C: number[][]) => {
    let m = Infinity;
    for (const k of C) m = Math.min(m, Math.hypot(d[i * 4] - k[0], d[i * 4 + 1] - k[1], d[i * 4 + 2] - k[2]));
    return m;
  };

  // 픽셀마다 '옷일 확률'을 만들고, 이웃과 함께 뭉쳐서(다수결) 작은 오판정과 톱니를 지운다
  const p = new Float32Array(w * h);
  for (let i = 0; i < p.length; i++) {
    if (sure[i]) p[i] = 1;
    else if (!near[i] || forcedBg[i]) p[i] = 0;
    else {
      const f = nearest(i, fgC) / (wanted[i] ? 1.35 : 1);
      const g = nearest(i, bgC);
      p[i] = g / (f + g + 1e-6);
    }
  }
  const smooth = blurFloat(blurFloat(p, w, h, 5), w, h, 5);
  let out: Uint8Array = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = !forcedBg[i] && (sure[i] || smooth[i] > 0.5) ? 1 : 0;
  out = boxFilter(boxFilter(out, w, h, 2, 'dilate'), w, h, 2, 'erode');
  // 마지막 점검: 둥글게 다듬다가 되살아난 바닥 그림자·배경 조각(옷보다 배경 색에 가까운 곳)을 뺀다
  for (let i = 0; i < out.length; i++) {
    if (!out[i] || sure[i]) continue;
    const bright = lumOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) > brightLimit;
    if (bright || nearest(i, bgC) < nearest(i, fgC) * 0.9) out[i] = 0;
  }
  return keepLargest(boxFilter(boxFilter(out, w, h, 1, 'erode'), w, h, 1, 'dilate'), w, h);
}

export interface PersonResult { mask: Uint8Array; person: number; found: number; kind: PhotoKind }

export async function personGarmentMask(c: HTMLCanvasElement, want: PhotoKind | 'auto', onProgress?: Progress): Promise<PersonResult> {
  const seg = await getSegmenter(onProgress);
  onProgress?.('사람이 입은 옷만 골라내는 중이에요');
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
  const url = URL.createObjectURL(blob);
  try {
    const out = await seg(url);
    const { width: w, height: h } = c;
    // 라벨마다 사진 크기의 마스크로 맞춘다
    const maps = new Map<string, Uint8Array>();
    for (const o of out) {
      if (o.label === 'Background') continue;
      const m = o.mask;
      const a = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        const my = Math.min(m.height - 1, Math.floor((y / h) * m.height));
        for (let x = 0; x < w; x++) {
          const mx = Math.min(m.width - 1, Math.floor((x / w) * m.width));
          if (m.data[my * m.width + mx] > 127) a[y * w + x] = 1;
        }
      }
      maps.set(o.label, a);
    }
    const area = (labels: string[]) => labels.reduce((n, l) => n + (maps.get(l)?.reduce((s, v) => s + v, 0) ?? 0), 0);
    let kind: PhotoKind;
    if (want === 'auto') {
      // 가장 넓게 찾힌 옷 종류를 고른다
      const cand: [PhotoKind, number][] = (['top', 'bottom', 'shoes'] as PhotoKind[]).map((k) => [k, area(LABELS[k])]);
      kind = cand.sort((p, q) => q[1] - p[1])[0][0];
    } else kind = want;

    const wanted = new Uint8Array(w * h);
    const hard = new Uint8Array(w * h);
    let person = 0;
    for (const [label, a] of maps) {
      const isWanted = LABELS[kind].includes(label);
      for (let i = 0; i < a.length; i++) {
        if (!a[i]) continue;
        if (isWanted) wanted[i] = 1;
        else {
          if (HARD_EXCLUDE.includes(label)) hard[i] = 1;
          if (PERSON_LABELS.includes(label)) person++;
        }
      }
    }
    onProgress?.('옷 윤곽을 색으로 다듬는 중이에요');
    const base = keepLargest(wanted, w, h);
    const refined = refineWithColors(c, base, hard);
    return { mask: refined, person: person / (w * h), found: area(LABELS[kind]) / (w * h), kind };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ------------------------------------------------------------------ 색 이름
const NAMED: [string, string][] = [
  ['화이트', '#f2f1ee'], ['아이보리', '#eae1cf'], ['베이지', '#d5bc95'], ['카멜', '#c09a6b'], ['브라운', '#8a5a36'], ['다크브라운', '#4a382e'],
  ['블랙', '#1f2023'], ['다크카키', '#54523f'], ['카키그레이', '#6c6c5e'], ['차콜', '#4b4d54'], ['그레이', '#8d9096'], ['네이비', '#2b3c66'], ['블루', '#4f7fc0'], ['하늘색', '#a9c6e8'],
  ['민트', '#a9d8cb'], ['카키', '#7d8260'], ['올리브', '#5e6350'], ['그린', '#4f8a5b'], ['옐로', '#e2c04e'], ['오렌지', '#dd8340'],
  ['레드', '#b84a43'], ['버건디', '#6e2a38'], ['핑크', '#e8b0b0'], ['퍼플', '#7f6aa6'],
];
const lab = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const r = lin(n >> 16), g = lin((n >> 8) & 255), b = lin(n & 255);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
export function nearestColorName(hex: string): string {
  const a = lab(hex);
  let best = NAMED[0][0], bd = Infinity;
  for (const [name, h] of NAMED) {
    const b = lab(h);
    const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return best;
}

/** 옷 안쪽 픽셀의 중앙 색 */
export function dominantHex(c: HTMLCanvasElement): string {
  const { width: w, height: h } = c;
  const d = pix(c).data;
  const px: { r: number; g: number; b: number; l: number }[] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 5000)));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 250) px.push({ r: d[i], g: d[i + 1], b: d[i + 2], l: d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 });
    }
  }
  if (!px.length) return '#c9c4ba';
  // 주름·솔기 그림자를 빼려고 밝기 35~85% 구간의 평균을 쓴다
  px.sort((p, q) => p.l - q.l);
  const part = px.slice(Math.floor(px.length * 0.35), Math.max(Math.floor(px.length * 0.35) + 1, Math.floor(px.length * 0.85)));
  const avg = (k: 'r' | 'g' | 'b') => Math.round(part.reduce((s, p) => s + p[k], 0) / part.length);
  return '#' + [avg('r'), avg('g'), avg('b')].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------ ③ 핏 기준점(랜드마크) 자동 추정
function silhouette(c: HTMLCanvasElement) {
  const { width: w, height: h } = c;
  const d = pix(c).data;
  const on = (x: number, y: number) => d[(y * w + x) * 4 + 3] > 128;
  const top = new Int32Array(w).fill(-1);
  const bottom = new Int32Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) if (on(x, y)) { top[x] = y; break; }
    for (let y = h - 1; y >= 0; y--) if (on(x, y)) { bottom[x] = y; break; }
  }
  const span = (y: number, x0: number, x1: number): [number, number] | null => {
    let l = -1, r = -1;
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) if (on(x, y)) { if (l < 0) l = x; r = x; }
    return l < 0 ? null : [l, r];
  };
  return { w, h, top, bottom, span };
}

export function estimatePoints(c: HTMLCanvasElement, kind: PhotoKind): Points {
  const { w, h, top, bottom, span } = silhouette(c);
  if (kind === 'bottom') {
    const yTop = top.reduce((m, v) => (v >= 0 && (m < 0 || v < m) ? v : m), -1);
    const yBot = bottom.reduce((m, v) => Math.max(m, v), 0);
    const row = span(Math.min(h - 1, yTop + Math.round(h * 0.03)), 0, w) ?? [0, w - 1];
    return { lWaist: [row[0], yTop], rWaist: [row[1], yTop], hem: [w / 2, yBot] };
  }
  if (kind === 'shoes') {
    // 밑창이 닿는 가장 아래 줄 (사진 아래 여백은 빼고)
    const sole = bottom.reduce((m, v) => Math.max(m, v), 0);
    return { hem: [w / 2, sole > 0 ? sole : h - 1] };
  }
  // 상의·아우터
  const sm = (arr: Int32Array, x: number, r = 3) => {
    let s = 0, n = 0;
    for (let i = -r; i <= r; i++) { const v = arr[Math.min(w - 1, Math.max(0, x + i))]; if (v >= 0) { s += v; n++; } }
    return n ? s / n : h;
  };
  // 목: 가운데 구간에서 가장 높은 곳
  let neckY = h;
  for (let x = Math.floor(w * 0.38); x <= Math.ceil(w * 0.62); x++) neckY = Math.min(neckY, sm(top, x));
  const neckXs: number[] = [];
  for (let x = Math.floor(w * 0.38); x <= Math.ceil(w * 0.62); x++) if (sm(top, x) <= neckY + h * 0.02) neckXs.push(x);
  const neckX = neckXs.length ? neckXs.reduce((a, b) => a + b, 0) / neckXs.length : w / 2;

  // 어깨 끝: 목에서 폭의 약 1/3 바깥을 기준으로, 윗선이 소매쪽으로 꺾여 내려가기 시작하는 곳을 찾아 그 근처로 맞춘다
  const tip = (dir: -1 | 1): Pt => {
    const guess = Math.round(neckX + dir * 0.32 * w);
    const clamp = (v: number) => Math.min(guess + 0.1 * w, Math.max(guess - 0.1 * w, v));
    let found = -1;
    for (let x = Math.round(neckX + dir * 0.12 * w); x > 4 && x < w - 5; x += dir) {
      if (Math.abs(x - neckX) > 0.46 * w) break;
      if (sm(top, x + dir * 4) - sm(top, x) > 3.6) { found = x; break; }
    }
    const x = Math.max(2, Math.min(w - 3, found >= 0 ? clamp(found) : guess));
    return [x, sm(top, x, 2)];
  };
  const ls = tip(-1);
  const rs = tip(1);

  // 소매 끝: 어깨 바깥쪽 영역에서 가장 아래
  const cuff = (x0: number, x1: number): Pt => {
    let by = -1, bx = (x0 + x1) / 2;
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) if (bottom[x] > by) { by = bottom[x]; bx = x; }
    // 같은 높이 근처의 가로 중앙
    const xs: number[] = [];
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) if (bottom[x] >= by - 3) xs.push(x);
    if (xs.length) bx = xs.reduce((a, b) => a + b, 0) / xs.length;
    return [bx, by];
  };
  const lc = cuff(0, Math.max(ls[0], w * 0.1));
  const rc = cuff(Math.min(rs[0], w * 0.9), w - 1);

  // 밑단: 가운데 구간 가장 아래
  let hemY = 0;
  for (let x = Math.floor(w * 0.34); x <= Math.ceil(w * 0.66); x++) hemY = Math.max(hemY, bottom[x]);
  return { neck: [neckX, neckY], lShoulder: ls, rShoulder: rs, lCuff: lc, rCuff: rc, hem: [neckX, hemY] };
}

// ------------------------------------------------------------------ 한 번에: 사진 → 누끼
export interface CutoutOptions { kind: PhotoKind | 'auto'; mode?: CutMode | 'auto'; tolerance?: number; /** false 면 안쪽에 갇힌 배경색 영역을 지우지 않는다(흰 신발처럼 옷 색이 배경과 비슷할 때) */ holes?: boolean; onProgress?: Progress }

export async function cutOut(source: HTMLCanvasElement, opt: CutoutOptions): Promise<Cutout> {
  const { onProgress } = opt;
  const tolerance = opt.tolerance ?? 36;
  let mode: CutMode = opt.mode === 'person' ? 'person' : 'flat';
  let flat: FlatResult | null = null;

  if (opt.mode !== 'person') {
    onProgress?.('배경을 지우는 중이에요');
    flat = flatBackgroundMask(source, tolerance, opt.holes !== false);
    // 사람이 입은 사진이거나 배경이 복잡하면 분할 모델로 넘어간다
    const complex = !flat.plain || flat.fraction > 0.82 || flat.skin > 0.015;
    if (opt.mode === 'auto' || opt.mode === undefined) mode = complex ? 'person' : 'flat';
  }

  let mask: Uint8Array;
  let kind: PhotoKind = opt.kind === 'auto' ? 'top' : opt.kind;
  if (mode === 'person') {
    const r = await personGarmentMask(source, opt.kind, onProgress);
    if (r.found < 0.01 && flat) {
      // 모델이 이 종류의 옷을 못 찾으면 배경 제거 결과로 되돌린다
      mode = 'flat';
      mask = flat.mask;
    } else {
      mask = r.mask;
      kind = r.kind;
    }
  } else {
    mask = (flat ?? flatBackgroundMask(source, tolerance, opt.holes !== false)).mask;
  }

  onProgress?.('핏 기준점을 찾는 중이에요');
  const canvas = applyMask(source, mask);
  // 옷만 있는 사진은 모양으로 종류를 짐작한다 (세로로 길면 하의)
  if (mode === 'flat' && opt.kind === 'auto') kind = canvas.height / canvas.width >= 1.55 ? 'bottom' : 'top';
  return { canvas, kind, mode, points: estimatePoints(canvas, kind), hex: dominantHex(canvas) };
}
