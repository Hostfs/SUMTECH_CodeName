"use client";

import Link from "next/link";
import { useData } from "@/components/DataProvider";
import {
  BellIcon,
  BodyIcon,
  BoxIcon,
  ChevronRightIcon,
  GearIcon,
  HelpIcon,
  LogoutIcon,
  PaletteIcon,
  ShirtIcon,
  UserIcon,
} from "@/components/icons";
import { Screen } from "@/components/layout/Screen";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/components/ui/Toast";
import { useNotifySettings } from "@/lib/notify";
import { rootPlaces } from "@/lib/places";
import { SEASON_LABEL } from "@/lib/theme";

const SOON = "준비 중인 기능이에요";

export default function MyPage() {
  const { garments, outfits, places, profile } = useData();
  const { setting, season } = useTheme();
  const toast = useToast();
  const [notify] = useNotifySettings();

  const themeValue = setting === "auto" ? `자동 · ${SEASON_LABEL[season]}` : SEASON_LABEL[season];
  const placeCount = rootPlaces(places).length;

  const menu: { label: string; Icon: typeof ShirtIcon; value?: React.ReactNode; href?: string }[] = [
    {
      label: "화면 테마",
      Icon: PaletteIcon,
      href: "/my/theme",
      value: (
        <>
          <span className="inline-block size-2.5 rounded-full bg-primary" aria-hidden />
          {themeValue}
        </>
      ),
    },
    {
      label: "내 체형",
      Icon: BodyIcon,
      href: "/my/body",
      value: profile.body ? `${profile.body.heightCm}cm · ${profile.body.weightKg}kg` : "등록 안 함",
    },
    { label: "저장한 코디", Icon: ShirtIcon, href: "/outfits?tab=saved", value: `${outfits.length}개` },
    { label: "보관 장소 관리", Icon: BoxIcon, href: "/storage", value: `${placeCount}곳` },
    { label: "알림 설정", Icon: BellIcon, href: "/my/notifications", value: notify.enabled ? "켜짐" : "꺼짐" },
    { label: "도움말·문의", Icon: HelpIcon },
  ];

  const rowCls = "flex h-[54px] w-full items-center gap-3 border-b border-line px-4 text-left text-[15.5px] last:border-0";

  return (
    <Screen withTabBar>
      <div className="flex h-[52px] items-center justify-between pt-2 pr-3 pl-5">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">마이</h1>
        <Link href="/my/theme" aria-label="설정" className="flex size-11 items-center justify-center">
          <GearIcon />
        </Link>
      </div>

      <div className="mx-4 mt-2 flex items-center gap-3.5 rounded-card-lg border border-line bg-card p-4">
        <span className="flex size-14 flex-none items-center justify-center rounded-full bg-soft text-deep">
          <UserIcon size={30} stroke={1.5} />
        </span>
        <span>
          <b className="block text-lg font-semibold">{profile.name}</b>
          <span className="mt-0.5 block text-[13px] text-sub">내 계정</span>
        </span>
        <button
          type="button"
          className="ml-auto h-[34px] rounded-full border border-line bg-card px-3 text-[13px] font-medium"
          onClick={() => toast(SOON)}
        >
          프로필 수정
        </button>
      </div>

      <div className="mx-4 mt-2.5 grid grid-cols-3 rounded-card-lg border border-line bg-card py-3.5 text-center">
        {[
          [garments.length, "내 옷"],
          [outfits.length, "코디"],
          [placeCount, "보관 장소"],
        ].map(([n, label]) => (
          <div key={label} className="border-r border-line last:border-0">
            <b className="block text-xl leading-normal font-bold">{n}</b>
            <span className="text-caption text-sub">{label}</span>
          </div>
        ))}
      </div>

      <ul className="mx-4 mt-3 overflow-hidden rounded-card-lg border border-line bg-card">
        {menu.map(({ label, Icon, value, href }) => {
          const inner = (
            <>
              <Icon size={22} stroke={1.6} />
              <span className="flex-1">{label}</span>
              {value && <span className="flex items-center gap-1.5 text-[13.5px] text-sub">{value}</span>}
              <ChevronRightIcon size={20} className="text-[#A9A69F]" />
            </>
          );
          return (
            <li key={label} className="border-b border-line last:border-0">
              {href ? (
                <Link href={href} className={rowCls}>
                  {inner}
                </Link>
              ) : (
                <button type="button" className={rowCls} onClick={() => toast(SOON)}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mx-4 mt-3 mb-4 overflow-hidden rounded-card-lg border border-line bg-card">
        <button type="button" className={rowCls + " text-sub"} onClick={() => toast(SOON)}>
          <LogoutIcon />
          <span className="flex-1">로그아웃</span>
        </button>
      </div>
    </Screen>
  );
}
