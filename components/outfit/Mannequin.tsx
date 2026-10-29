"use client";

import { bodyShape, DEFAULT_BODY } from "@/lib/body";
import { useCutout, type Cutout } from "@/lib/cutout";
import type { Body, Garment } from "@/lib/types";

export type Worn = Partial<Record<"outer" | "top" | "bottom" | "shoes", Garment>>;

/**
 * 옷 그림을 몸의 정해진 자리에 맞춰 놓는다.
 * 그림에서 배경을 뺀 '옷 윤곽'을 기준으로 맞추므로, 사진의 여백이나 구도가 달라도 어긋나지 않는다.
 * - tw: 윤곽의 가로 폭을 이 값에 맞춘다
 * - th: 있으면 윤곽의 세로도 이 값에 정확히 맞추고(바지처럼 길이가 정해진 옷), 없으면 가로세로 비율을 지킨다
 * - top / bottom: 윤곽의 위쪽 또는 아래쪽을 이 y에 맞춘다
 */
function Fit({
  cutout,
  cx,
  tw,
  th,
  top,
  bottom,
  flip,
}: {
  cutout: Cutout | null;
  cx: number;
  tw: number;
  th?: number;
  top?: number;
  bottom?: number;
  flip?: boolean;
}) {
  if (!cutout) return null;
  const { box, aspect, href } = cutout;
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  const W = tw / bw;
  const H = th ? th / bh : W / aspect;
  const x = cx - (box.x0 + bw / 2) * W;
  const y = bottom !== undefined ? bottom - box.y1 * H : (top ?? 0) - box.y0 * H;
  return (
    <image
      href={href}
      x={x}
      y={y}
      width={W}
      height={H}
      preserveAspectRatio="none"
      transform={flip ? `translate(${2 * cx} 0) scale(-1 1)` : undefined}
    />
  );
}

const SKIN = "#E9E6E0";
const EDGE = "#D4D0C8";

/**
 * 2D 코디 마네킹. 키·몸무게로 체형이 달라지고, 고른 옷 그림을 몸 위에 겹쳐 입힌다.
 * 옷 그림은 사진(또는 임시 SVG)을 그대로 쓰므로 평면 이미지를 몸 위에 올리는 방식이다.
 */
export function Mannequin({
  body,
  worn,
  height = 320,
  className,
}: {
  body?: Body;
  worn?: Worn;
  /** 화면에 그려질 높이(px) */
  height?: number;
  className?: string;
}) {
  const b = body ?? DEFAULT_BODY;
  const { sy, k } = bodyShape(b);

  const outer = useCutout(worn?.outer?.photoUrl);
  const top = useCutout(worn?.top?.photoUrl);
  const bottom = useCutout(worn?.bottom?.photoUrl);
  const shoes = useCutout(worn?.shoes?.photoUrl);

  // 부위별 치수 (viewBox 200×440, 가운데 x=100, 발 y=430)
  const sw = 50 * k(0.55); // 어깨 반폭
  const ww = 35 * k(1); // 허리 반폭
  const hw = 44 * k(0.9); // 엉덩이 반폭
  const armW = 13 * k(0.7);
  const thighW = 28 * k(0.9);
  const calfW = 18 * k(0.6);
  const legX = hw * 0.5;
  /** 팔이 가장 바깥으로 나가는 지점(손목)까지의 반폭. 상의·아우터 소매가 여기까지 덮는다. */
  const armOuter = sw + 12 + armW / 2;

  const torso = `M ${100 - sw * 0.4} 74 Q ${100 - sw} 76 ${100 - sw} 92 L ${100 - ww} 170 Q ${100 - ww - 2} 200 ${100 - hw} 236 Q 100 252 ${100 + hw} 236 Q ${100 + ww + 2} 200 ${100 + ww} 170 L ${100 + sw} 92 Q ${100 + sw} 76 ${100 + sw * 0.4} 74 Z`;

  const arm = (dir: -1 | 1) => `${100 + dir * (sw - 2)},88 ${100 + dir * (sw + 8)},150 ${100 + dir * (sw + 12)},210`;
  const leg = (dir: -1 | 1) => ({
    thigh: `${100 + dir * legX},236 ${100 + dir * (legX + 1)},335`,
    calf: `${100 + dir * (legX + 1)},335 ${100 + dir * (legX - 1)},420`,
  });

  return (
    <svg
      viewBox="0 0 200 440"
      height={height}
      width={(height * 200) / 440}
      role="img"
      aria-label={`코디 마네킹 (키 ${b.heightCm}cm, 몸무게 ${b.weightKg}kg)`}
      className={className}
    >
      {/* 바닥 그림자 (키가 작아져도 그대로) */}
      <ellipse cx="100" cy="433" rx="56" ry="5" fill="#1D1D1F" opacity=".06" />

      <g transform={`translate(100 430) scale(1 ${sy}) translate(-100 -430)`}>
        {/* 몸 */}
        <g fill={SKIN} stroke={EDGE} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
          {[-1, 1].map((d) => {
            const l = leg(d as -1 | 1);
            return (
              <g key={d}>
                <polyline points={l.thigh} fill="none" stroke={EDGE} strokeWidth={thighW + 2.4} />
                <polyline points={l.calf} fill="none" stroke={EDGE} strokeWidth={calfW + 2.4} />
                <polyline points={l.thigh} fill="none" stroke={SKIN} strokeWidth={thighW} />
                <polyline points={l.calf} fill="none" stroke={SKIN} strokeWidth={calfW} />
                <ellipse cx={100 + d * (legX - 2)} cy="426" rx="13" ry="6" />
              </g>
            );
          })}
          {[-1, 1].map((d) => (
            <g key={d}>
              <polyline points={arm(d as -1 | 1)} fill="none" stroke={EDGE} strokeWidth={armW + 2.4} />
              <polyline points={arm(d as -1 | 1)} fill="none" stroke={SKIN} strokeWidth={armW} />
            </g>
          ))}
          <path d={torso} />
          <rect x="92" y="58" width="16" height="22" rx="5" />
          <ellipse cx="100" cy="40" rx="21" ry="26" />
        </g>

        {/* 옷: 하의 → 신발 → 상의 → 아우터 순으로 겹친다 */}
        <Fit cutout={bottom} cx={100} tw={2 * hw + 8} top={172} th={246} />
        {[-1, 1].map((d) => (
          <Fit key={d} cutout={shoes} cx={100 + d * (legX - 2)} tw={44} bottom={433} flip={d === -1} />
        ))}
        <Fit cutout={top} cx={100} tw={2 * armOuter + 4} top={70} />
        <Fit cutout={outer} cx={100} tw={2 * armOuter + 20} top={64} />
      </g>
    </svg>
  );
}
