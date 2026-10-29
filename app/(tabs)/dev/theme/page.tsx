"use client";

import { useState } from "react";
import { Screen } from "@/components/layout/Screen";
import { useTheme } from "@/components/ThemeProvider";
import { SEASON_LABEL, SEASON_PRIMARY, SEASONS, type ThemeSetting } from "@/lib/theme";

/** 1단계 임시 화면: 계절 테마 전환과 토큰을 확인한다. 실제 화면 테마 설정은 /my/theme에서 만든다. */
export default function ThemeDevPage() {
  const { setting, season, setSetting } = useTheme();
  // 테마를 바꿔도 입력값이 유지되는지 확인용
  const [text, setText] = useState("");
  const options: ThemeSetting[] = ["auto", ...SEASONS];

  return (
    <Screen withTabBar>
      <div className="flex h-12 items-center px-5 pt-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          테마 확인
          <small className="ml-2 text-sm font-normal tracking-[-0.01em] text-sub">
            지금은 {SEASON_LABEL[season]}
          </small>
        </h1>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => setSetting(o)}
            className={
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-[13px] text-sm whitespace-nowrap " +
              (setting === o ? "border-primary bg-primary font-semibold text-on" : "border-line bg-card text-ink")
            }
          >
            {o !== "auto" && (
              <span className="size-2.5 rounded-full" style={{ background: SEASON_PRIMARY[o] }} aria-hidden />
            )}
            {o === "auto" ? "자동" : SEASON_LABEL[o]}
          </button>
        ))}
      </div>

      <div className="mx-4 mt-4 h-11 rounded-full border border-line bg-card px-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="이름·색상·위치로 검색"
          className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
      </div>

      <section className="mx-4 mt-4 rounded-card border border-line bg-card p-4">
        <h2 className="text-base font-semibold">버튼</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="h-11 rounded-full bg-primary px-[18px] text-[15px] font-semibold text-on">위치 변경</button>
          <button className="h-11 rounded-full border border-line bg-card px-[18px] text-[15px] font-semibold">
            수정
          </button>
          <button className="h-11 px-3 text-[15px] text-sub">삭제</button>
        </div>

        <h2 className="mt-5 text-base font-semibold">배지</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-[26px] items-center rounded-full bg-soft px-2.5 text-[13px] font-semibold text-deep">
            가을
          </span>
          <span className="inline-flex h-[26px] items-center rounded-full bg-soft px-2.5 text-[13px] font-semibold text-deep">
            겨울
          </span>
          <span className="rounded-full bg-nobadge px-[9px] py-0.5 text-xs text-sub">위치 미지정</span>
        </div>
      </section>

      <section className="mx-4 mt-3 flex items-center gap-3.5 rounded-card-lg bg-soft p-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary text-on">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="1.7" fill="none" aria-hidden>
            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
        </span>
        <span>
          <span className="block text-[13px] text-sub">보관 위치</span>
          <span className="block text-xl font-bold">옷장 A › 왼쪽 행거</span>
        </span>
      </section>

      <p className="mx-5 mt-4 pb-6 text-[13.5px] leading-normal text-sub">
        일교차가 커요.
        <br />
        얇은 아우터를 챙겨 보세요.
        <br />
        <span className="font-semibold text-deep">코디 보기 ›</span>
      </p>
    </Screen>
  );
}
