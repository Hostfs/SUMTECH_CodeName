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
const HOLE_TOL = 42; // 막힌 배경: 지워진 배경 팔레트와 이 정도까지 비슷하면 배경

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
    let holeTol = HOLE_TOL;

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
      // 스튜디오 사진(흰 신발+연회색 배경처럼 옷과 배경 색이 비슷한 경우): 가장자리가 거의 한 색이면 배경 판정을 아주 빡빡하게 해서
      // 옷이 배경으로 번지지 않게 한다. 배경이 얼룩덜룩한 사진은 기존 기준을 쓴다.
      let borderSpread = 0;
      let borderN = 0;
      const refC = corners.length ? [0, 1, 2].map((c) => corners.reduce((a, k) => a + k[c], 0) / corners.length) : [0, 0, 0];
      for (let x = 0; x < w; x += 3) {
        for (const y of [0, h - 1]) {
          const i = (y * w + x) * 4;
          borderSpread += Math.hypot(d[i] - refC[0], d[i + 1] - refC[1], d[i + 2] - refC[2]);
          borderN++;
        }
      }
      for (let y = 0; y < h; y += 3) {
        for (const x of [0, w - 1]) {
          const i = (y * w + x) * 4;
          borderSpread += Math.hypot(d[i] - refC[0], d[i + 1] - refC[1], d[i + 2] - refC[2]);
          borderN++;
        }
      }
      const studio = borderN > 0 && borderSpread / borderN < 9 && corners.every((c) => Math.hypot(c[0] - refC[0], c[1] - refC[1], c[2] - refC[2]) < 14);
      const seedTol = studio ? 26 : SEED_TOL;
      const stepTol = studio ? 8 : STEP_TOL;
      const farTol = studio ? 30 : FAR_TOL;
      holeTol = studio ? 22 : HOLE_TOL;
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
        if (d[i + 3] >= ALPHA_MIN && !corners.some((c) => dist(d, i, c) < seedTol)) return;
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
          if (Math.hypot(d[i] - d[j], d[i + 1] - d[j + 1], d[i + 2] - d[j + 2]) > stepTol) return;
          if (Math.hypot(d[i] - sr[from], d[i + 1] - sg[from], d[i + 2] - sb[from]) > farTol) return;
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

    // 사진: 바지 다리 사이처럼 가장자리와 이어지지 않아 번지지 못한 '막힌 배경'을 지운다.
    // 이미 지워진 배경의 대표 색(팔레트)을 모아서, 그 색과 거의 같은 픽셀이 넓게 뭉쳐 있으면 배경으로 본다.
    if (!isSvg) {
      const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
      for (let p = 0; p < w * h; p += 3) {
        if (d[p * 4 + 3] !== 0) continue;
        const key = ((d[p * 4] >> 4) << 8) | ((d[p * 4 + 1] >> 4) << 4) | (d[p * 4 + 2] >> 4);
        const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
        e.n++;
        e.r += d[p * 4];
        e.g += d[p * 4 + 1];
        e.b += d[p * 4 + 2];
        buckets.set(key, e);
      }
      const palette = [...buckets.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, 8)
        .filter((e) => e.n >= 20)
        .map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);
      if (palette.length > 0) {
        const bgLike = new Uint8Array(w * h);
        for (let p = 0; p < w * h; p++) {
          const i = p * 4;
          if (d[i + 3] < ALPHA_MIN) continue;
          if (palette.some((c) => dist(d, i, c) < holeTol)) bgLike[p] = 1;
        }
        const seen = new Uint8Array(w * h);
        const stack = new Int32Array(w * h);
        const members = new Int32Array(w * h);
        const minArea = Math.max(120, Math.round(w * h * 0.003));
        for (let start = 0; start < w * h; start++) {
          if (!bgLike[start] || seen[start]) continue;
          let sp = 0;
          let n = 0;
          stack[sp++] = start;
          seen[start] = 1;
          while (sp > 0) {
            const p = stack[--sp];
            members[n++] = p;
            const px = p % w;
            const py = (p - px) / w;
            if (px > 0 && bgLike[p - 1] && !seen[p - 1]) (seen[p - 1] = 1), (stack[sp++] = p - 1);
            if (px < w - 1 && bgLike[p + 1] && !seen[p + 1]) (seen[p + 1] = 1), (stack[sp++] = p + 1);
            if (py > 0 && bgLike[p - w] && !seen[p - w]) (seen[p - w] = 1), (stack[sp++] = p - w);
            if (py < h - 1 && bgLike[p + w] && !seen[p + w]) (seen[p + w] = 1), (stack[sp++] = p + w);
          }
          if (n >= minArea) for (let k = 0; k < n; k++) d[members[k] * 4 + 3] = 0;
        }
      }
      ctx.putImageData(image, 0, 0);
    }

    // 사진: 얇은 선(이미지 가장자리에 남은 1~2픽셀 테두리, 화면 캡처의 가는 선)을 지운다.
    // 옷 모양을 2번 깎았다가 2번 되살리는 방식(열기)이라, 5픽셀보다 얇은 조각만 사라진다.
    if (!isSvg) {
      const mask = new Uint8Array(w * h);
      for (let p = 0; p < w * h; p++) mask[p] = d[p * 4 + 3] >= ALPHA_MIN ? 1 : 0;
      const step = (m: Uint8Array, grow: boolean) => {
        const o = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let all = true;
            let any = false;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                // 깎을 때는 화면 밖을 '있음'으로 쳐서 가장자리에 걸친 옷이 깎이지 않게 한다
                const v = nx < 0 || ny < 0 || nx >= w || ny >= h ? (grow ? 0 : 1) : m[ny * w + nx];
                if (v) any = true;
                else all = false;
              }
            }
            o[y * w + x] = grow ? (any ? 1 : 0) : all ? 1 : 0;
          }
        }
        return o;
      };
      let opened = step(step(mask, false), false);
      opened = step(step(opened, true), true);
      for (let p = 0; p < w * h; p++) {
        if (mask[p] && !opened[p]) d[p * 4 + 3] = 0;
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

    // 모델이 입은 사진: 옷 위·아래에 이어 붙은 맨살 줄(허리·발목)을 잘라 낸다.
    // 옷 색이 살색과 비슷하면(베이지·카멜) 구분할 수 없으므로, 옷의 대표 색과 확실히 다른 살색 줄만 자른다.
    if (!isSvg) {
      const isSkin = (r: number, g: number, b: number) =>
        r > 95 && g > 40 && b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15 && Math.abs(r - g) > 15 && r > g && r > b;
      // 옷의 대표 색: 남은 픽셀 색의 중앙값
      const samples: number[][] = [[], [], []];
      for (let p = 0; p < w * h; p += 7) {
        if (d[p * 4 + 3] < ALPHA_MIN) continue;
        for (let c = 0; c < 3; c++) samples[c].push(d[p * 4 + c]);
      }
      if (samples[0].length > 50) {
        const med = samples.map((a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)]);
        const row = (y: number) => {
          let n = 0;
          let skin = 0;
          let r = 0;
          let g = 0;
          let b = 0;
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (d[i + 3] < ALPHA_MIN) continue;
            n++;
            r += d[i];
            g += d[i + 1];
            b += d[i + 2];
            if (isSkin(d[i], d[i + 1], d[i + 2])) skin++;
          }
          return { n, skinFrac: n ? skin / n : 0, avg: n ? [r / n, g / n, b / n] : med };
        };
        const isSkinRow = (y: number) => {
          const s = row(y);
          if (s.n === 0) return null; // 빈 줄
          const far = Math.hypot(s.avg[0] - med[0], s.avg[1] - med[1], s.avg[2] - med[2]) > 45;
          return s.skinFrac >= 0.4 && far;
        };
        const clearRow = (y: number) => {
          for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = 0;
        };
        const limit = Math.round(h * 0.4); // 최대 이만큼만 잘라 낸다
        // 위에서부터: 빈 줄은 건너뛰고, 살색 줄이 이어지는 동안 지운다
        let cut = 0;
        for (let y = 0; y < h && cut < limit; y++) {
          const s = isSkinRow(y);
          if (s === null) continue;
          if (!s) break;
          clearRow(y);
          cut++;
        }
        // 아래에서부터: 옷 몸통 색과 확연히 다른 줄(모델이 신은 신발)이 이어지면 지운다. 신발은 따로 입히므로 바지에는 필요 없다.
        // 기준색은 옷 윗부분~가운데 줄들의 평균 색이다. 어둡든 밝든(검정 구두, 흰 운동화) 기준색과 멀면 신발로 본다.
        let top0 = -1;
        let bot0 = -1;
        for (let y = 0; y < h; y++) {
          if (row(y).n > 0) {
            if (top0 < 0) top0 = y;
            bot0 = y;
          }
        }
        if (top0 >= 0 && bot0 - top0 > 60) {
          const span = bot0 - top0;
          const ref = [0, 0, 0];
          let rn = 0;
          for (let y = Math.round(top0 + span * 0.35); y <= Math.round(top0 + span * 0.65); y++) {
            const s = row(y);
            if (s.n === 0) continue;
            for (let c = 0; c < 3; c++) ref[c] += s.avg[c];
            rn++;
          }
          if (rn > 0) {
            for (let c = 0; c < 3; c++) ref[c] /= rn;
            const far = (r: number, g: number, b: number, t: number) => Math.hypot(r - ref[0], g - ref[1], b - ref[2]) > t;
            const shoeRow = (y: number) => {
              let n = 0;
              let off = 0;
              let ar = 0;
              let ag = 0;
              let ab = 0;
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                if (d[i + 3] < ALPHA_MIN) continue;
                n++;
                ar += d[i];
                ag += d[i + 1];
                ab += d[i + 2];
                if (far(d[i], d[i + 1], d[i + 2], 60)) off++;
              }
              if (n === 0) return null;
              return off / n >= 0.35 || far(ar / n, ag / n, ab / n, 32);
            };
            const maxShoe = Math.round(span * 0.3);
            const vals: (boolean | null)[] = [];
            for (let y = bot0; y >= bot0 - maxShoe; y--) vals.push(shoeRow(y));
            // 줄 하나는 들쭉날쭉해서 아래 7줄 중 절반 넘게 신발색이면 신발 줄로 본다.
            // 맨 아래 테두리 몇 줄과, 신발 중간에 끼어든 옷 색 줄(발목)은 건너뛴다.
            let last = -1;
            let gap = 0;
            for (let k = 0; k < vals.length; k++) {
              if (vals[k] === null) continue;
              const win = vals.slice(k, k + 7).filter((v) => v !== null);
              if (win.filter(Boolean).length * 2 > win.length) {
                last = k;
                gap = 0;
              } else if (++gap > (last < 0 ? 10 : 6)) break;
            }
            // 3줄 미만이면 그림자·솔기로 보고 둔다.
            if (last >= 2) for (let k = 0; k <= last; k++) clearRow(bot0 - k);
          }
        }
        cut = 0;
        for (let y = h - 1; y >= 0 && cut < limit; y--) {
          const s = isSkinRow(y);
          if (s === null) continue;
          if (!s) break;
          clearRow(y);
          cut++;
        }
        ctx.putImageData(image, 0, 0);
      }
    }

    // 옆모습 신발·샌들처럼 가로로 긴 옷은 한 줄 안이 비어 있을 리 없으니, 줄마다 왼쪽 끝~오른쪽 끝 사이를 채운다.
    // 흰 신발처럼 배경과 색이 비슷해 윗부분이 파먹힌 경우를 되살린다. (바지·윗옷은 가로로 길지 않아 해당 없음)
    if (!isSvg) {
      let bx0 = w;
      let bx1 = -1;
      let by0 = h;
      let by1 = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] >= ALPHA_MIN) {
            if (x < bx0) bx0 = x;
            if (x > bx1) bx1 = x;
            if (y < by0) by0 = y;
            if (y > by1) by1 = y;
          }
        }
      }
      if (bx1 > bx0 && by1 > by0 && (bx1 - bx0) / (by1 - by0) >= 1.5) {
        for (let y = by0; y <= by1; y++) {
          let lo = -1;
          let hi = -1;
          for (let x = bx0; x <= bx1; x++) {
            if (d[(y * w + x) * 4 + 3] >= ALPHA_MIN) {
              if (lo < 0) lo = x;
              hi = x;
            }
          }
          if (lo < 0) continue;
          for (let x = lo; x <= hi; x++) d[(y * w + x) * 4 + 3] = 255;
        }
        ctx.putImageData(image, 0, 0);
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
