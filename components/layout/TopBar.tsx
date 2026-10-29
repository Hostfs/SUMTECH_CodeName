"use client";

import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/icons";

/** 상단바: 왼쪽 뒤로가기(44px), 가운데 제목 17px/600, 오른쪽 슬롯 (design-system 4절) */
export function TopBar({
  title,
  right,
  fallbackHref = "/closet",
}: {
  title: string;
  right?: React.ReactNode;
  /** 바로 들어온 경우(뒤로 갈 기록이 없을 때) 갈 곳 */
  fallbackHref?: string;
}) {
  const router = useRouter();
  const back = () => (window.history.length > 1 ? router.back() : router.replace(fallbackHref));

  return (
    <div className="relative flex h-12 items-center justify-between px-3">
      <button type="button" aria-label="뒤로" className="flex size-11 items-center justify-center" onClick={back}>
        <BackIcon />
      </button>
      <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold">{title}</h1>
      <div className="flex size-11 items-center justify-center">{right}</div>
    </div>
  );
}
