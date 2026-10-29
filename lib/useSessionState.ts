"use client";

import { useEffect, useState } from "react";

/**
 * 탭 안에서 화면을 오가도 유지되는 상태 (예: 내 옷장 검색어·필터).
 * 상세에 갔다가 돌아와도 그대로 남는다. 첫 렌더는 initial로 그려서 hydration을 맞춘다.
 */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  // 저장된 값을 읽기 전에 initial로 덮어쓰지 않도록, 읽은 뒤에만 저장한다
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {}
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, hydrated]);

  return [value, setValue] as const;
}
