"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { WeatherBackground } from "@/components/home/WeatherBackground";
import { deg, WeatherWidget } from "@/components/home/WeatherWidget";
import {
  BellIcon,
  CameraIcon,
  CloudIcon,
  HangerIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  ShirtIcon,
  SunIcon,
} from "@/components/icons";
import { Screen } from "@/components/layout/Screen";
import { dueItems, useNotifySettings } from "@/lib/notify";
import { seasonOfMonth, seoulMonth, SEASONS, type Season } from "@/lib/theme";
import { HOME_COPY, WEATHER_ERROR } from "@/lib/weather/copy";
import { createMockWeather } from "@/lib/weather/mock";
import { CONDITION_LABEL, type WeatherCondition, type WeatherToday } from "@/lib/weather/types";

type WeatherState = { status: "loading" } | { status: "ok"; data: WeatherToday; season: Season } | { status: "error" };

/**
 * 화면 확인용 주소 파라미터: ?season=spring|summer|autumn|winter&weather=sunny|cloudy|error
 * (목업 8장과 비교할 때 쓴다. 없으면 오늘 날짜의 계절 + 맑음)
 */
function readOverrides() {
  const p = new URLSearchParams(window.location.search);
  const s = p.get("season");
  const w = p.get("weather");
  return {
    season: SEASONS.includes(s as Season) ? (s as Season) : undefined,
    condition: w === "sunny" || w === "cloudy" ? (w as WeatherCondition) : undefined,
    fail: w === "error",
  };
}

export default function HomePage() {
  const router = useRouter();
  const { profile, garments } = useData();
  const [notify] = useNotifySettings();
  const dueCount = notify.enabled ? dueItems(garments, notify.leadDays).length : 0;
  const [weather, setWeather] = useState<WeatherState>({ status: "loading" });
  const [q, setQ] = useState("");

  useEffect(() => {
    const o = readOverrides();
    createMockWeather(o)
      .getToday()
      .then((data) => setWeather({ status: "ok", data, season: o.season ?? seasonOfMonth(seoulMonth()) }))
      .catch(() => setWeather({ status: "error" }));
  }, []);

  const ok = weather.status === "ok" ? weather : null;
  const copy = ok ? HOME_COPY[ok.season][ok.data.condition] : null;
  const PillIcon = ok?.data.condition === "cloudy" ? CloudIcon : SunIcon;

  const search = () => router.push(q.trim() ? `/closet?q=${encodeURIComponent(q.trim())}` : "/closet");

  return (
    <Screen withTabBar background={<WeatherBackground condition={ok ? ok.data.condition : null} />}>
      <div className="relative flex min-h-full flex-col">
        {/* 헤더: 로고 + 알림 */}
        <div className="flex h-[94px] items-start px-5 pt-2">
          <div className="flex h-11 flex-1 items-center justify-between">
            <span className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em]">
              <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-on">
                <HangerIcon size={19} stroke={1.7} />
              </span>
              내 옷장
            </span>
            <button
              type="button"
              aria-label={dueCount > 0 ? `알림 ${dueCount}개` : "알림"}
              className="relative flex size-10 items-center justify-center rounded-full border border-line bg-white/85"
              onClick={() => router.push("/notifications")}
            >
              <BellIcon />
              {dueCount > 0 && (
                <span className="absolute top-[7px] right-[8px] size-2.5 rounded-full border-2 border-white bg-primary" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* 인사 영역 */}
        <div className="h-[158px] px-6 text-center">
          <span
            className={
              "inline-flex h-[30px] items-center gap-1.5 rounded-full border border-line bg-white/80 px-3 text-[13px] font-medium " +
              (ok ? "" : "invisible")
            }
          >
            <PillIcon size={16} stroke={1.7} />
            {ok ? `오늘은 ${CONDITION_LABEL[ok.data.condition]} · ${deg(ok.data.temp)}` : " "}
          </span>
          <h1 className="mt-3.5 text-[26px] leading-[1.3] font-semibold tracking-[-0.025em]">
            안녕하세요, {profile.name}님
          </h1>
          {copy && (
            <p className="mt-2 text-[15px] leading-normal text-sub">
              {copy.greeting[0]}
              <br />
              {copy.greeting[1]}
            </p>
          )}
        </div>

        {/* 검색 */}
        <form
          role="search"
          className="mx-4 flex h-14 items-center gap-2.5 rounded-[28px] border border-line bg-card px-[7px]"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <Link
            href="/closet/new"
            aria-label="옷 등록"
            className="flex size-[42px] flex-none items-center justify-center rounded-full bg-bg text-ink"
          >
            <PlusIcon size={22} stroke={1.7} />
          </Link>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름·색상·위치로 검색"
            enterKeyHint="search"
            aria-label="옷 검색"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-sub [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="submit"
            aria-label="검색"
            className="flex size-[42px] flex-none items-center justify-center rounded-full bg-primary text-on"
          >
            <SearchIcon size={20} stroke={1.9} />
          </button>
        </form>

        {/* 바로가기 */}
        <nav className="mx-4 mt-3.5 flex justify-center gap-2" aria-label="바로가기">
          {[
            { href: "/storage", label: "위치 정하기", Icon: PinIcon },
            { href: "/outfits", label: "코디 만들기", Icon: ShirtIcon },
            { href: "/closet/new", label: "옷 등록", Icon: CameraIcon },
          ].map(({ href, label, Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-[13px] text-[13.5px] whitespace-nowrap"
            >
              <Icon size={16} stroke={1.7} />
              {label}
            </Link>
          ))}
        </nav>

        {/* 날씨 위젯: 탭 바 위 16px에 붙는다 */}
        <div className="flex-1" />
        <div className="mx-4 mt-6 mb-4">
          {ok && copy && <WeatherWidget weather={ok.data} tip={copy.tip} />}
          {weather.status === "loading" && <div className="h-[273px]" aria-hidden />}
          {weather.status === "error" && (
            <div className="rounded-card-lg border border-dashed border-dash bg-white/60 px-4 py-6 text-center text-[13.5px] leading-normal text-sub">
              {WEATHER_ERROR[0]}
              <br />
              {WEATHER_ERROR[1]}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
