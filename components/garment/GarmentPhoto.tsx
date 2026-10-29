/* eslint-disable @next/next/no-img-element -- 사용자 사진(data URL, blob)도 그대로 보여 줘야 해서 img를 쓴다 */
import { HangerIcon } from "@/components/icons";

/** 옷 사진. 정사각형 영역에 contain + 여백으로 옷 전체가 보이게 한다 (CLAUDE.md 4절) */
export function GarmentPhoto({ src, alt, size }: { src?: string; alt: string; size: number }) {
  if (!src) {
    return (
      <span className="flex items-center justify-center text-muted" style={{ width: size, height: size }}>
        <HangerIcon size={Math.round(size * 0.4)} />
      </span>
    );
  }
  return <img src={src} alt={alt} width={size} height={size} className="block object-contain" draggable={false} />;
}
