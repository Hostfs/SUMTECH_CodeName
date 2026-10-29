"use client";

import { CheckIcon } from "@/components/icons";
import { Screen } from "@/components/layout/Screen";
import { TopBar } from "@/components/layout/TopBar";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { seasonOfMonth, seoulMonth, SEASON_LABEL, SEASON_PRIMARY, type ThemeSetting } from "@/lib/theme";

const MONTHS: Record<Exclude<ThemeSetting, "auto">, string> = {
  spring: "3~5월",
  summer: "6~8월",
  autumn: "9~11월",
  winter: "12~2월",
};

/** 화면 테마 (theme_autumn.html). 저장 버튼 없이 고르면 바로 적용된다. */
export default function ThemePage() {
  const { setting, season, setSetting } = useTheme();
  const autoSeason = seasonOfMonth(seoulMonth());
  const options: ThemeSetting[] = ["auto", "spring", "summer", "autumn", "winter"];

  return (
    <Screen>
      <div className="flex min-h-full flex-col">
        <TopBar title="화면 테마" fallbackHref="/my" />
        <p className="px-5 pt-2 text-[13.5px] leading-normal text-sub">
          ‘자동’은 한국 기준 계절에 맞춰 색이 바뀌어요.
          <br />
          화면 색상만 바뀌고 옷 정보는 바뀌지 않아요.
        </p>

        <div role="radiogroup" aria-label="화면 테마" className="mx-4 mt-3 overflow-hidden rounded-card-lg border border-line bg-card">
          {options.map((o) => {
            const on = setting === o;
            const swatch = SEASON_PRIMARY[o === "auto" ? autoSeason : o];
            return (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={o === "auto" ? "자동" : SEASON_LABEL[o]}
                onClick={() => setSetting(o)}
                className="flex h-[58px] w-full items-center gap-3 border-b border-line px-4 text-left last:border-0"
              >
                <span
                  className={
                    "flex size-6 flex-none items-center justify-center rounded-full border-[1.6px] " +
                    (on ? "border-primary bg-primary text-on" : "border-[#CFCCC5]")
                  }
                >
                  {on && <CheckIcon size={14} stroke={2.6} />}
                </span>
                <span className="flex-1">
                  <b className="block text-base font-semibold">{o === "auto" ? "자동" : SEASON_LABEL[o]}</b>
                  <span className="mt-px block text-caption text-sub">
                    {o === "auto" ? `지금은 ${SEASON_LABEL[autoSeason]}이에요` : MONTHS[o]}
                  </span>
                </span>
                <span className="size-[22px] rounded-full border border-black/10" style={{ background: swatch }} aria-hidden />
              </button>
            );
          })}
        </div>

        <h2 className="px-5 pt-3.5 text-[15px] font-semibold">미리보기</h2>
        <div className="mx-4 mt-2 rounded-card-lg border border-line bg-card p-3.5" aria-hidden>
          <div className="flex items-center gap-2">
            <Chip selected tabIndex={-1}>
              전체
            </Chip>
            <Chip tabIndex={-1}>상의</Chip>
            <Chip tabIndex={-1}>하의</Chip>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <Button className="h-10 px-4 text-sm" tabIndex={-1}>
              위치 변경
            </Button>
            <span className="flex h-[26px] items-center rounded-full bg-soft px-2.5 text-caption font-semibold text-deep">
              {SEASON_LABEL[season]}
            </span>
          </div>
        </div>

        <p className="mt-auto pt-6 pb-[30px] text-center text-[13px] text-sub">선택하면 바로 적용돼요</p>
      </div>
    </Screen>
  );
}
