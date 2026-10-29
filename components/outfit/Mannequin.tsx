import { bodyShape, DEFAULT_BODY } from "@/lib/body";
import type { Body, Garment } from "@/lib/types";

export type Worn = Partial<Record<"outer" | "top" | "bottom" | "shoes", Garment>>;

/** 사진은 흰 배경이 마네킹 위에서 사라지게 multiply로 겹친다. 투명한 SVG 그림은 그대로 둔다. */
function Piece({
  src,
  x,
  y,
  w,
  h,
  align = "xMidYMin",
  flip,
}: {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  align?: string;
  flip?: boolean;
}) {
  const isSvg = src.startsWith("data:image/svg");
  return (
    <image
      href={src}
      x={x}
      y={y}
      width={w}
      height={h}
      preserveAspectRatio={`${align} meet`}
      transform={flip ? `translate(${2 * x + w} 0) scale(-1 1)` : undefined}
      style={isSvg ? undefined : { mixBlendMode: "multiply" }}
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

  // 부위별 치수 (viewBox 200×440, 가운데 x=100, 발 y=430)
  const sw = 50 * k(0.55); // 어깨 반폭
  const ww = 35 * k(1); // 허리 반폭
  const hw = 44 * k(0.9); // 엉덩이 반폭
  const armW = 13 * k(0.7);
  const thighW = 28 * k(0.9);
  const calfW = 18 * k(0.6);
  const legX = hw * 0.5;
  // 옷은 몸이 넓어진 만큼만 가로로 늘린다
  const kx = k(0.7);

  const torso = `M ${100 - sw * 0.4} 74 Q ${100 - sw} 76 ${100 - sw} 92 L ${100 - ww} 170 Q ${100 - ww - 2} 200 ${100 - hw} 236 Q 100 252 ${100 + hw} 236 Q ${100 + ww + 2} 200 ${100 + ww} 170 L ${100 + sw} 92 Q ${100 + sw} 76 ${100 + sw * 0.4} 74 Z`;

  const arm = (dir: -1 | 1) =>
    `${100 + dir * (sw - 2)},88 ${100 + dir * (sw + 8)},150 ${100 + dir * (sw + 12)},210`;
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

        {/* 옷: 신발 → 하의 → 상의 → 아우터 순으로 겹친다 */}
        <g transform={`translate(100 0) scale(${kx} 1) translate(-100 0)`}>
          {worn?.bottom?.photoUrl && <Piece src={worn.bottom.photoUrl} x={100 - 120} y={176} w={240} h={240} />}
        </g>
        {worn?.shoes?.photoUrl &&
          [-1, 1].map((d) => (
            <Piece
              key={d}
              src={worn.shoes!.photoUrl!}
              x={100 + d * (legX - 2) - 45}
              y={364}
              w={90}
              h={70}
              align="xMidYMax"
              flip={d === -1}
            />
          ))}
        <g transform={`translate(100 0) scale(${kx} 1) translate(-100 0)`}>
          {worn?.top?.photoUrl && <Piece src={worn.top.photoUrl} x={100 - 80} y={60} w={160} h={170} />}
          {worn?.outer?.photoUrl && <Piece src={worn.outer.photoUrl} x={100 - 110} y={58} w={220} h={240} />}
        </g>
      </g>
    </svg>
  );
}
