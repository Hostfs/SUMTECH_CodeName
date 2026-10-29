"use client";

import { useEffect, useState } from "react";

/** 옷 이미지에서 배경을 걷어내고 옷이 차지하는 영역(윤곽 상자)을 찾은 결과 */
export interface Cutout {
  /** 배경이 투명해진 이미지 */
  href: string;
  /** 이미지 가로/세로 비율 */
  aspect: number;
  /** 옷 윤곽 상자 (이미지 전체를 0~1로 본 좌표) */
  box: { x0: number; y0: number; x1: number; y1: number };
}

const MAX = 480; // 처리용으로 줄이는 최대 크기(px)
const ALPHA_MIN = 24;
// 배경 걷어내기 기준 (RGB 거리)
const SEED_TOL = 55; // 가장자리 픽셀이 모서리 색과 이 정도까지 비슷하면 배경 씨앗
const STEP_TOL = 22; // 이웃 픽셀과 이 정도까지 비슷해야 배경이 이어진다
const FAR_TOL = 85; // 씨앗 색에서 이보다 멀어지면 멈춘다 (서서히 변하는 옷 가장자리가 새는 것 방지)

const cache = new Map<string, Promise<Cutout | null>>();
const ready = new Map<string, Cutout | null>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode failed"));
    img.src = src;
  });
}

const dist = (d: Uint8ClampedArray, i: number, c: number[]) =>
  Math.hypot(d[i] - c[0], d[i + 1] - c[1], d[i + 2] - c[2]);

async function compute(src: string): Promise<Cutout | null> {
  try {
    const img = await loadImage(src);
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    const d = image.data;
    const isSvg = src.startsWith("data:image/svg");

    // 사진: 가장자리에서부터 배경을 걷어낸다. 배경이 한 가지 색이 아니어도(벽+바닥, 그라데이션) 되도록,
    // 모서리 색과 비슷한 가장자리 픽셀을 씨앗으로 삼아 '이웃과 색이 비슷하게 이어지는 동안'만 번져 나간다.
    // 옷의 가장자리는 배경과 색이 확 달라서 거기서 멈춘다.
    if (!isSvg) {
      const patch = (cx: number, cy: number): number[] | null => {
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let y = cy - 1; y <= cy + 1; y++) {
          for (let x = cx - 1; x <= cx + 1; x++) {
            const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
            if (d[i + 3] < 200) continue;
            r += d[i];
            g += d[i + 1];
            b += d[i + 2];
            n++;
          }
        }
        return n ? [r / n, g / n, b / n] : null;
      };
      const corners = [patch(1, 1), patch(w - 2, 1), patch(1, h - 2), patch(w - 2, h - 2)].filter((c): c is number[] => !!c);
      const seen = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      const sr = new Uint8Array(w * h); // 번지기 시작한 씨앗의 색
      const sg = new Uint8Array(w * h);
      const sb = new Uint8Array(w * h);
      let head = 0;
      let tail = 0;

      const seed = (p: number) => {
        if (seen[p]) return;
        seen[p] = 1;
        const i = p * 4;
        if (d[i + 3] >= ALPHA_MIN && !corners.some((c) => dist(d, i, c) < SEED_TOL)) return;
        sr[p] = d[i];
        sg[p] = d[i + 1];
        sb[p] = d[i + 2];
        queue[tail++] = p;
      };
      const grow = (q: number, from: number) => {
        if (seen[q]) return;
        seen[q] = 1;
        const i = q * 4;
        const j = from * 4;
        if (d[i + 3] >= ALPHA_MIN) {
          if (Math.hypot(d[i] - d[j], d[i + 1] - d[j + 1], d[i + 2] - d[j + 2]) > STEP_TOL) return;
          if (Math.hypot(d[i] - sr[from], d[i + 1] - sg[from], d[i + 2] - sb[from]) > FAR_TOL) return;
        }
        sr[q] = sr[from];
        sg[q] = sg[from];
        sb[q] = sb[from];
        queue[tail++] = q;
      };

      for (let x = 0; x < w; x++) {
        seed(x);
        seed((h - 1) * w + x);
      }
      for (let y = 0; y < h; y++) {
        seed(y * w);
        seed(y * w + w - 1);
      }
      while (head < tail) {
        const p = queue[head++];
        d[p * 4 + 3] = 0;
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0) grow(p - 1, p);
        if (x < w - 1) grow(p + 1, p);
        if (y > 0) grow(p - w, p);
        if (y < h - 1) grow(p + w, p);
      }
      ctx.putImageData(image, 0, 0);
    }

    // 사진: 가장 큰 덩어리(옷)만 남기고 떨어져 있는 작은 조각(쇼핑몰 화면의 화살표·'AI' 버튼, 먼지 등)은 지운다.
    // 옷의 일부(두 짝의 신발, 소매 등)는 큰 덩어리의 10% 이상이면 남긴다.
    if (!isSvg) {
      const label = new Int32Array(w * h);
      const stack = new Int32Array(w * h);
      const sizes: number[] = [0];
      let id = 0;
      for (let start = 0; start < w * h; start++) {
        if (label[start] || d[start * 4 + 3] < ALPHA_MIN) continue;
        id++;
        let sp = 0;
        let size = 0;
        stack[sp++] = start;
        label[start] = id;
        while (sp > 0) {
          const p = stack[--sp];
          size++;
          const px = p % w;
          const py = (p - px) / w;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = px + dx;
              const ny = py + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const q = ny * w + nx;
              if (label[q] || d[q * 4 + 3] < ALPHA_MIN) continue;
              label[q] = id;
              stack[sp++] = q;
            }
          }
        }
        sizes.push(size);
      }
      const largest = sizes.reduce((a, b) => Math.max(a, b), 0);
      for (let p = 0; p < w * h; p++) {
        if (label[p] && sizes[label[p]] < largest * 0.1) d[p * 4 + 3] = 0;
      }
      ctx.putImageData(image, 0, 0);
    }

    // 옷 윤곽 상자: 투명하지 않은 픽셀이 2개 이상 있는 가장 바깥 줄·칸
    const rows = new Uint16Array(h);
    const cols = new Uint16Array(w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] >= ALPHA_MIN) {
          rows[y]++;
          cols[x]++;
        }
      }
    }
    const first = (a: Uint16Array) => a.findIndex((v) => v >= 2);
    const last = (a: Uint16Array) => {
      for (let i = a.length - 1; i >= 0; i--) if (a[i] >= 2) return i;
      return -1;
    };
    const x0 = first(cols);
    const x1 = last(cols);
    const y0 = first(rows);
    const y1 = last(rows);
    if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0) return null;

    return {
      href: isSvg ? src : canvas.toDataURL("image/png"),
      aspect: img.naturalWidth / img.naturalHeight,
      box: { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h },
    };
  } catch {
    // 이미지를 읽지 못하면(원격 사진의 CORS 등) 이미지 전체를 옷으로 본다
    try {
      const img = await loadImage(src);
      return { href: src, aspect: img.naturalWidth / img.naturalHeight, box: { x0: 0, y0: 0, x1: 1, y1: 1 } };
    } catch {
      return null;
    }
  }
}

export function loadCutout(src: string): Promise<Cutout | null> {
  let p = cache.get(src);
  if (!p) {
    p = compute(src).then((r) => {
      ready.set(src, r);
      return r;
    });
    cache.set(src, p);
  }
  return p;
}

/** src가 바뀌면 다시 계산한다. 이미 계산한 그림은 깜빡임 없이 바로 돌려준다. */
export function useCutout(src?: string): Cutout | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (!src || ready.has(src)) return;
    let on = true;
    loadCutout(src).then(() => on && force((n) => n + 1));
    return () => {
      on = false;
    };
  }, [src]);
  return src ? (ready.get(src) ?? null) : null;
}
