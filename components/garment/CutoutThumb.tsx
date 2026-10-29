"use client";

import { useCutout } from "@/lib/cutout";
import { GarmentPhoto } from "./GarmentPhoto";

/**
 * 배경을 지우고 옷 윤곽에 맞춰 잘라 보여 주는 미리보기 (옷 등록 화면).
 * 마네킹에 입혀질 때 쓰는 것과 같은 결과라서, 올리는 순간 잘 지워졌는지 확인할 수 있다.
 * 아직 계산 중이거나 처리하지 못한 사진은 원본을 보여 준다.
 */
export function CutoutThumb({ src, size }: { src?: string; size: number }) {
  const c = useCutout(src);
  if (!src || !c) return <GarmentPhoto src={src} alt="올린 사진" size={size} />;
  const { box, aspect, href } = c;
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${box.x0 * aspect} ${box.y0} ${bw * aspect} ${bh}`}
      role="img"
      aria-label="배경을 지운 옷"
      className="block"
    >
      <image href={href} x={0} y={0} width={aspect} height={1} preserveAspectRatio="none" />
    </svg>
  );
}
