/** 날씨 상태. 1차는 sunny·cloudy, 이후 rain·snow·night를 더한다 (screens.md 1절) */
export type WeatherCondition = "sunny" | "cloudy";

/** 시간대 예보 아이콘 */
export type HourIcon = "sun" | "partly" | "cloud" | "rain" | "snow" | "moon";

export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  sunny: "맑음",
  cloudy: "흐림",
};

export interface WeatherToday {
  region: string;
  /** 'YYYY-MM-DD' (Asia/Seoul) */
  date: string;
  condition: WeatherCondition;
  temp: number;
  high: number;
  low: number;
  /** 5칸: 지금, 15시, 18시, 21시, 24시 */
  hours: { label: string; icon: HourIcon; temp: number }[];
}

/** 날씨는 이 인터페이스 뒤에 둔다. 1차는 목업, 이후 실제 날씨 API로 바꾼다. */
export interface WeatherProvider {
  getToday(): Promise<WeatherToday>;
}
