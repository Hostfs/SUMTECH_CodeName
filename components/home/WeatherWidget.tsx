import Link from "next/link";
import {
  ChevronRightIcon,
  CloudIcon,
  MoonIcon,
  PartlyCloudyIcon,
  PinIcon,
  RainIcon,
  ShirtIcon,
  SnowIcon,
  SunIcon,
} from "@/components/icons";
import { CONDITION_LABEL, type HourIcon, type WeatherToday } from "@/lib/weather/types";

const HOUR_ICON: Record<HourIcon, typeof SunIcon> = {
  sun: SunIcon,
  partly: PartlyCloudyIcon,
  cloud: CloudIcon,
  rain: RainIcon,
  snow: SnowIcon,
  moon: MoonIcon,
};

export const deg = (n: number) => `${n}°`;

/** 'YYYY-MM-DD' → '10월 29일 목요일' */
function dateLabel(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** 홈 날씨 위젯 (design/html/home_*.html .wg) */
export function WeatherWidget({ weather, tip }: { weather: WeatherToday; tip: [string, string] }) {
  const BigIcon = weather.condition === "sunny" ? SunIcon : CloudIcon;
  return (
    <section className="rounded-card-lg border border-line bg-card px-4 pt-4 pb-3.5" aria-label="오늘 날씨">
      <div className="flex items-center justify-between text-[13px] text-sub">
        <b className="flex items-center gap-1 text-sm font-semibold text-ink">
          <PinIcon size={15} stroke={1.8} />
          {weather.region}
        </b>
        <span>{dateLabel(weather.date)}</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-[46px] leading-none font-semibold tracking-[-0.04em]">{deg(weather.temp)}</div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <b className="block text-[17px] font-semibold tracking-[-0.02em]">{CONDITION_LABEL[weather.condition]}</b>
            <span className="mt-[3px] block text-[13px] text-sub">
              최고 {deg(weather.high)} · 최저 {deg(weather.low)}
            </span>
          </div>
          <span className="flex text-deep">
            <BigIcon size={40} stroke={1.4} />
          </span>
        </div>
      </div>

      <ul className="mt-3.5 grid grid-cols-5 border-t border-line pt-3 text-center">
        {weather.hours.map((h) => {
          const I = HOUR_ICON[h.icon];
          return (
            <li key={h.label} className="flex flex-col items-center gap-1.5 text-caption text-sub">
              <span>{h.label}</span>
              <span className="flex text-ink">
                <I />
              </span>
              <b className="text-sm font-semibold text-ink">{deg(h.temp)}</b>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-soft py-3 pr-3 pl-3.5">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-deep">
          <ShirtIcon size={20} stroke={1.6} />
        </span>
        <p className="flex-1 text-[13.5px] leading-normal text-ink">
          {tip[0]}
          <br />
          {tip[1]}
        </p>
        <Link href="/outfits" className="flex items-center text-[13px] font-semibold whitespace-nowrap text-deep">
          코디 보기
          <ChevronRightIcon size={16} stroke={2} />
        </Link>
      </div>
    </section>
  );
}
