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
const BG_TOLERANCE = 38; // 배경색과 이 정도까지 비슷하면 배경으로 본다 (RGB 거리)

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

    // 사진: 네 모서리 색이 비슷하면 그 색을 배경으로 보고, 가장자리에서 이어진 배경 픽셀만 투명하게 만든다
    if (!isSvg) {
      const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4].filter((i) => d[i + 3] > 200);
      if (corners.length >= 3) {
        const bg = [0, 1, 2].map((c) => corners.map((i) => d[i + c]).sort((a, b) => a - b)[Math.floor(corners.length / 2)]);
        const agree = corners.every((i) => dist(d, i, bg) < 60);
        if (agree) {
          const seen = new Uint8Array(w * h);
          const queue = new Int32Array(w * h);
          let head = 0;
          let tail = 0;
          const push = (p: number) => {
            if (seen[p]) return;
            seen[p] = 1;
            if (d[p * 4 + 3] < ALPHA_MIN || dist(d, p * 4, bg) < BG_TOLERANCE) queue[tail++] = p;
          };
          for (let x = 0; x < w; x++) {
            push(x);
            push((h - 1) * w + x);
          }
          for (let y = 0; y < h; y++) {
            push(y * w);
            push(y * w + w - 1);
          }
          while (head < tail) {
            const p = queue[head++];
            d[p * 4 + 3] = 0;
            const x = p % w;
            const y = (p - x) / w;
            if (x > 0) push(p - 1);
            if (x < w - 1) push(p + 1);
            if (y > 0) push(p - w);
            if (y < h - 1) push(p + w);
          }
          ctx.putImageData(image, 0, 0);
        }
      }
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
