import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SEASON_KEY, seasonFromKey, seasonOf, type Season, type ThemeMode } from './seasons';
import { load, query, save } from './storage';

interface ThemeValue {
  mode: ThemeMode;
  /** 지금 적용 중인 계절 (auto 이면 오늘 날짜 기준) */
  season: Season;
  setMode: (mode: ThemeMode) => void;
}

const Ctx = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(
    () => seasonFromKey(query.get('season')) ?? load<ThemeMode>('ot.theme', 'auto'),
  );
  const season = mode === 'auto' ? seasonOf(new Date()) : mode;

  useEffect(() => {
    document.documentElement.dataset.season = SEASON_KEY[season];
  }, [season]);

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      season,
      setMode: (next) => {
        setModeState(next);
        save('ot.theme', next);
      },
    }),
    [mode, season],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('ThemeProvider 안에서만 사용할 수 있어요');
  return v;
}
