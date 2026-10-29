"use client";

import { balance, ratioOf, type WornSlot } from "@/lib/balance";
import { bodyShape, DEFAULT_BODY } from "@/lib/body";
import { useCutout, type Cutout } from "@/lib/cutout";
import type { Body, Garment } from "@/lib/types";

export type Worn = Partial<Record<"outer" | "top" | "bottom" | "shoes" | "hat" | "etc", Garment>>;

/**
 * 옷 그림을 몸의 정해진 자리에 맞춰 놓는다.
 * 그림에서 배경을 뺀 '옷 윤곽'을 기준으로 맞추므로, 사진의 여백이나 구도가 달라도 어긋나지 않는다.
 * - tw / th: 윤곽의 가로·세로를 이 값에 맞춘다. 값은 lib/balance.ts가 옷 종류별로 균형 있게 정한다
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
  th: number;
  top?: number;
  bottom?: number;
  flip?: boolean;
}) {
  if (!cutout) return null;
  const { box, href } = cutout;
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  const W = tw / bw;
  const H = th / bh;
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

/**
 * 옆모습 신발을 정면에서 본 것처럼 다시 구성한다.
 * 옆모습의 앞코 쪽(앞 60%)만 잘라 가로로 좁히고, 바깥쪽으로 살짝 벌려 놓는다. 뒤꿈치·옆면은 정면에서 안 보이므로 쓰지 않는다.
 * (사진을 새로 그리는 것은 아니라 근사치다.)
 */
function FrontShoe({ cutout, cx, bottom, d, tw0 }: { cutout: Cutout; cx: number; bottom: number; d: -1 | 1; tw0: number }) {
  const { box, aspect, href, toe } = cutout;
  const bw = box.x1 - box.x0;
  const keep = 0.6;
  const cropped: Cutout = {
    ...cutout,
    box: toe === "left" ? { ...box, x1: box.x0 + bw * keep } : { ...box, x0: box.x1 - bw * keep },
  };
  const sp = balance("shoes", cropped, tw0);
  const tw = sp.tw * 0.9; // 정면이라 폭을 좁힌다
  const th = sp.th;
  const cb = cropped.box;
  const toeRight = toe !== "left";
  // 오른발은 앞코가 오른쪽, 왼발은 왼쪽을 향하게
  const flip = d === 1 ? !toeRight : toeRight;
  return (
    <svg
      x={cx - tw / 2}
      y={bottom - th}
      width={tw}
      height={th}
      viewBox={`${cb.x0 * aspect} ${cb.y0} ${(cb.x1 - cb.x0) * aspect} ${cb.y1 - cb.y0}`}
      preserveAspectRatio="none"
      overflow="hidden"
      transform={`rotate(${d * 8} ${cx} ${bottom})` + (flip ? ` translate(${2 * cx} 0) scale(-1 1)` : "")}
    >
      <image href={href} x={0} y={0} width={aspect} height={1} preserveAspectRatio="none" />
    </svg>
  );
}

/** 옷이 없으면 아무것도 그리지 않는 자리(0)를 돌려주고, 있으면 균형 보정한 크기를 돌려준다 */
function plan(slot: WornSlot, c: Cutout | null, tw0: number) {
  return c ? balance(slot, c, tw0) : { tw: 0, th: 0 };
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
  const hat = useCutout(worn?.hat?.photoUrl);
  const etc = useCutout(worn?.etc?.photoUrl);

  // 부위별 치수 (viewBox 200×440, 가운데 x=100, 발 y=430)
  const sw = 50 * k(0.55); // 어깨 반폭
  // 윗옷을 입으면 몸의 어깨선을 안으로 들여서 옷 어깨 밖으로 마네킹이 튀어나오지 않게 한다
  const clothed = Boolean(top || outer);
  const ww = 35 * k(1); // 허리 반폭
  const hw = 44 * k(0.9); // 엉덩이 반폭
  const armW = 13 * k(0.7);
  const thighW = 28 * k(0.9);
  const calfW = 18 * k(0.6);
  const legX = hw * 0.5;
  /** 팔이 가장 바깥으로 나가는 지점(손목)까지의 반폭. 상의·아우터 소매가 여기까지 덮는다. */
  const armOuter = sw + 12 + armW / 2;
  // 실제로 입힌 윗옷의 폭 안쪽으로 몸 어깨를 들인다 (옷 어깨는 둥글어서 몸 모서리가 삐져나오기 쉽다)
  const clothTw = outer ? plan("outer", outer, 2 * armOuter + 20).tw : top ? plan("top", top, 2 * armOuter + 4).tw : 0;
  const bsw = clothed ? Math.min(sw * 0.78, (clothTw / 2) * 0.55) : sw;
  const sy0 = clothed ? 84 : 74; // 윗옷 안쪽 어깨 높이

  const torso = `M ${100 - bsw * 0.4} ${sy0} Q ${100 - bsw} ${sy0 + 2} ${100 - bsw} 100 L ${100 - ww} 170 Q ${100 - ww - 2} 200 ${100 - hw} 236 Q 100 252 ${100 + hw} 236 Q ${100 + ww + 2} 200 ${100 + ww} 170 L ${100 + bsw} 100 Q ${100 + bsw} ${sy0 + 2} ${100 + bsw * 0.4} ${sy0} Z`;

  // 옷을 입으면 손이 소매 끝으로 삐져나오지 않게 팔을 위쪽만 그린다(긴 소매는 이 아래를 덮는다)
  const arm = (dir: -1 | 1) =>
    clothed
      ? `${100 + dir * (bsw - 2)},104 ${100 + dir * (bsw + 3)},135`
      : `${100 + dir * (sw - 2)},88 ${100 + dir * (sw + 8)},150 ${100 + dir * (sw + 12)},210`;
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

        {/* 옷: 신발 → 하의(밑단이 신발을 덮는다) → 상의 → 아우터 순으로 겹친다 */}
        {[-1, 1].map((d) => {
          if (!shoes) return null;
          // 옆모습 신발(가로로 긴 사진)은 정면 신발처럼 다시 구성해서 놓는다
          if (ratioOf(shoes) < 0.75) {
            return <FrontShoe key={d} cutout={shoes} cx={100 + d * (legX + 9)} bottom={433} d={d as -1 | 1} tw0={54} />;
          }
          return <Fit key={d} cutout={shoes} cx={100 + d * (legX - 2)} bottom={433} flip={d === -1} {...plan("shoes", shoes, 52)} />;
        })}
        <Fit cutout={bottom} cx={100} top={172} {...plan("bottom", bottom, 2 * hw + 8)} />
        <Fit cutout={top} cx={100} top={70} {...plan("top", top, 2 * armOuter + 4)} />
        <Fit cutout={outer} cx={100} top={64} {...plan("outer", outer, 2 * armOuter + 20)} />
        {/* 가방·소품은 오른손 쪽에 늘어뜨리고, 모자는 머리 위에 씌운다 */}
        <Fit cutout={etc} cx={100 + armOuter + 4} top={168} {...plan("etc", etc, 40)} />
        <Fit cutout={hat} cx={100} bottom={38} {...plan("hat", hat, 50)} />
      </g>
    </svg>
  );
}
