"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { resolveSeason, THEME_STORAGE_KEY, type Season, type ThemeSetting } from "@/lib/theme";

interface ThemeContextValue {
  setting: ThemeSetting;
  season: Season;
  setSetting: (s: ThemeSetting) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSetting(): ThemeSetting {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "auto" || v === "spring" || v === "summer" || v === "autumn" || v === "winter") return v;
  } catch {}
  return "auto";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [setting, setSettingState] = useState<ThemeSetting>("auto");
  const [season, setSeason] = useState<Season>(() => resolveSeason("auto"));

  useEffect(() => {
    const s = readSetting();
    setSettingState(s);
    setSeason(resolveSeason(s));
  }, []);

  // 테마는 <html> 속성만 바꾼다. 화면의 React 상태(검색어, 입력값)는 그대로 남는다.
  const setSetting = useCallback((s: ThemeSetting) => {
    const next = resolveSeason(s);
    document.documentElement.setAttribute("data-season", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, s);
    } catch {}
    setSettingState(s);
    setSeason(next);
  }, []);

  return <ThemeContext.Provider value={{ setting, season, setSetting }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
