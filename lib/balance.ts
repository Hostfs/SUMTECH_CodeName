import type { Cutout } from "./cutout";

export type WornSlot = "outer" | "top" | "bottom" | "shoes";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 옷 윤곽의 세로/가로 비율 (실제 픽셀 기준) */
export function ratioOf(c: Cutout): number {
  const bw = c.box.x1 - c.box.x0;
  const bh = c.box.y1 - c.box.y0;
  return bh / bw / c.aspect;
}

/**
 * 사진마다 구도가 달라도 마네킹 위에서 균형이 맞도록 옷의 크기를 보정한다.
 * 몸에 맞는 이상적인 가로 폭(tw0)을 기준으로 하되, 옷 종류마다 자연스러운 길이 범위 안으로 맞춘다.
 * 가로세로를 따로 늘리는 정도도 제한해서 옷이 찌그러져 보이지 않게 한다. (색은 건드리지 않는다)
 *
 * viewBox 기준 좌표: 목 y=70, 허리 y=172, 엉덩이 y=236, 무릎 y≈335, 발목 y≈418, 바닥 y=433
 */
export function balance(slot: WornSlot, c: Cutout, tw0: number): { tw: number; th: number } {
  const r = ratioOf(c);
  const th0 = tw0 * r; // 가로를 몸에 맞췄을 때 옷이 가지는 자연스러운 길이

  switch (slot) {
    case "top": {
      // 목~엉덩이 사이: 너무 짧은 크롭도, 엉덩이를 넘는 긴 티도 이 범위로
      const th = clamp(th0, 100, 165);
      return { th, tw: clamp(th / r, tw0 * 0.82, tw0 * 1.12) };
    }
    case "outer": {
      // 어깨~무릎 위: 숏 재킷부터 롱코트까지
      const th = clamp(th0, 130, 250);
      return { th, tw: clamp(th / r, tw0 * 0.85, tw0 * 1.12) };
    }
    case "bottom": {
      if (th0 >= 180) {
        // 긴 바지: 길이는 허리~발목에 맞추고, 폭은 원래 모양을 최대한 살린다 (와이드 팬츠는 넓게)
        const th = 246;
        return { th, tw: clamp(th / r, tw0 * 0.8, tw0 * 1.3) };
      }
      // 반바지·치마: 발목까지 늘리지 않고 원래 길이를 지킨다
      const th = clamp(th0, 70, 175);
      return { th, tw: clamp(th / r, tw0 * 0.95, tw0 * 1.25) };
    }
    case "shoes": {
      const th = clamp(th0, 22, 62);
      return { th, tw: clamp(th / r, tw0 * 0.75, tw0 * 1.2) };
    }
  }
}
