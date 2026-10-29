import { seasonOfMonth, seoulMonth, type Season } from "../theme";
import type { HourIcon, WeatherCondition, WeatherProvider, WeatherToday } from "./types";

// 목업 HTML(design/html/home_{season}_{sunny|cloudy}.html)의 숫자를 그대로 옮겼다. 모두 예시 값이다.
type Mock = Omit<WeatherToday, "region" | "date" | "condition" | "hours"> & { hours: [HourIcon, number][] };

const H = ["지금", "15시", "18시", "21시", "24시"];

const MOCK: Record<Season, Record<WeatherCondition, Mock> & { date: string }> = {
  spring: {
    date: "2026-04-15",
    sunny: { temp: 19, high: 22, low: 10, hours: [["sun", 19], ["sun", 22], ["partly", 18], ["moon", 14], ["moon", 11]] },
    cloudy: { temp: 14, high: 16, low: 9, hours: [["cloud", 14], ["cloud", 16], ["rain", 13], ["rain", 11], ["cloud", 10]] },
  },
  summer: {
    date: "2026-07-15",
    sunny: { temp: 29, high: 32, low: 24, hours: [["sun", 29], ["sun", 32], ["partly", 30], ["moon", 27], ["moon", 25]] },
    cloudy: { temp: 26, high: 28, low: 23, hours: [["cloud", 26], ["rain", 28], ["rain", 26], ["cloud", 24], ["cloud", 23]] },
  },
  autumn: {
    date: "2026-10-29",
    sunny: { temp: 18, high: 21, low: 9, hours: [["sun", 18], ["sun", 21], ["partly", 17], ["moon", 13], ["moon", 10]] },
    cloudy: { temp: 15, high: 17, low: 11, hours: [["cloud", 15], ["cloud", 17], ["cloud", 14], ["rain", 12], ["rain", 11]] },
  },
  winter: {
    date: "2026-12-16",
    sunny: { temp: 2, high: 4, low: -6, hours: [["sun", 2], ["sun", 4], ["partly", 0], ["moon", -3], ["moon", -5]] },
    cloudy: { temp: -1, high: 1, low: -5, hours: [["cloud", -1], ["cloud", 1], ["snow", -1], ["snow", -3], ["cloud", -4]] },
  },
};

function seoulToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/**
 * 목업 날씨. 기본은 오늘 날짜의 계절 + 맑음.
 * 화면 확인용으로 season·condition을 넘기면 그 목업(날짜 포함)을 그대로 돌려준다.
 * fail이면 오류를 낸다 (불러오기 실패 화면 확인용).
 */
export function createMockWeather(opts: { season?: Season; condition?: WeatherCondition; fail?: boolean } = {}): WeatherProvider {
  return {
    async getToday() {
      if (opts.fail) throw new Error("mock weather failure");
      const season = opts.season ?? seasonOfMonth(seoulMonth());
      const condition = opts.condition ?? "sunny";
      const m = MOCK[season][condition];
      return {
        region: "광주",
        date: opts.season ? MOCK[season].date : seoulToday(),
        condition,
        temp: m.temp,
        high: m.high,
        low: m.low,
        hours: m.hours.map(([icon, temp], i) => ({ label: H[i], icon, temp })),
      };
    },
  };
}
