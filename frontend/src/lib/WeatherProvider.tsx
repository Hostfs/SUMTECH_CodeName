import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SAMPLES, fetchWeather, sampleForNow, type Weather } from './weather';
import { query } from './storage';

interface WeatherValue {
  weather: Weather | null;
  source: 'live' | 'sample' | 'loading';
  scenario: string;
  setScenario: (id: string) => void;
}

const Ctx = createContext<WeatherValue | null>(null);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<string>(() => query.get('wx') ?? 'live');
  const [live, setLive] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (scenario !== 'live') return;
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), 8000);
    const run = () =>
      fetchWeather(ctrl.signal)
        .then((w) => {
          setLive(w);
          setFailed(false);
        })
        .catch(() => setFailed(true));
    run();
    const every = window.setInterval(run, 30 * 60 * 1000);
    return () => {
      ctrl.abort();
      window.clearTimeout(timeout);
      window.clearInterval(every);
    };
  }, [scenario]);

  const value = useMemo<WeatherValue>(() => {
    if (scenario !== 'live') return { weather: SAMPLES[scenario] ?? sampleForNow(), source: 'sample', scenario, setScenario };
    if (live) return { weather: live, source: 'live', scenario, setScenario };
    if (failed) return { weather: sampleForNow(), source: 'sample', scenario, setScenario };
    return { weather: null, source: 'loading', scenario, setScenario };
  }, [scenario, live, failed]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWeather() {
  const v = useContext(Ctx);
  if (!v) throw new Error('WeatherProvider 안에서만 사용할 수 있어요');
  return v;
}
