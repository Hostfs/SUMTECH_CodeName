"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { GarmentPhoto } from "@/components/garment/GarmentPhoto";
import { ChevronRightIcon } from "@/components/icons";
import { Screen } from "@/components/layout/Screen";
import { TopBar } from "@/components/layout/TopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { dueDetail, dueItems, useNotifySettings } from "@/lib/notify";
import { garmentHref } from "@/lib/routes";

const BADGE = { overdue: "지남", today: "오늘", soon: "곧" } as const;

/** 알림 목록: 세탁·수선을 맡긴 옷 중 찾을 때가 된 것 */
export default function NotificationsPage() {
  const { garments } = useData();
  const [settings] = useNotifySettings();
  const items = useMemo(
    () => (settings.enabled ? dueItems(garments, settings.leadDays) : []),
    [garments, settings.enabled, settings.leadDays],
  );

  return (
    <Screen>
      <TopBar title="알림" fallbackHref="/" />

      {items.length === 0 ? (
        <EmptyState className="mx-4 mt-6">
          {settings.enabled ? (
            <>
              새 알림이 없어요.
              <br />
              맡긴 옷을 찾을 때가 되면 알려 드려요.
            </>
          ) : (
            <>
              알림이 꺼져 있어요.
              <br />
              알림 설정에서 켤 수 있어요.
            </>
          )}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2 px-4 pt-2">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={garmentHref(item.garment.id)}
                className="flex items-center gap-3 rounded-card border border-line bg-card py-2.5 pr-3 pl-2.5"
              >
                <span className="flex size-14 flex-none items-center justify-center rounded-xl bg-tile">
                  <GarmentPhoto src={item.garment.photoUrl} alt="" size={44} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-semibold">{item.garment.name}</b>
                  <span className="mt-0.5 block text-caption text-sub">{dueDetail(item)}</span>
                </span>
                <span
                  className={
                    "flex h-[22px] flex-none items-center rounded-full px-2 text-xs font-semibold " +
                    (item.stage === "soon" ? "bg-soft text-deep" : "bg-primary text-on")
                  }
                >
                  {BADGE[item.stage]}
                </span>
                <ChevronRightIcon size={18} className="flex-none text-[#A9A69F]" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="px-5 pt-4 pb-6 text-center text-[13px]">
        <Link href="/my/notifications" className="font-semibold text-deep">
          알림 설정 ›
        </Link>
      </p>
    </Screen>
  );
}
