"use client";

import { useEffect, useState } from "react";
import { Screen } from "@/components/layout/Screen";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useNotifySettings } from "@/lib/notify";

const LEADS = [
  { days: 0, label: "당일" },
  { days: 1, label: "1일 전" },
  { days: 2, label: "2일 전" },
  { days: 3, label: "3일 전" },
] as const;

/** 알림 설정: 세탁·수선 찾을 날짜 알림 (목업 없음) */
export default function NotifySettingsPage() {
  const toast = useToast();
  const [settings, update] = useNotifySettings();
  // 브라우저 알림 권한은 렌더 중에 읽지 않고 마운트 뒤에 읽는다 (서버 렌더와 맞추기 위해)
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const toggleBrowser = async (on: boolean) => {
    if (!on) return update({ browser: false });
    if (typeof Notification === "undefined") {
      toast("이 브라우저는 알림을 지원하지 않아요");
      return;
    }
    let p = Notification.permission;
    if (p === "default") p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      update({ browser: true });
      toast("브라우저 알림을 켰어요");
    } else {
      toast("브라우저에서 알림이 막혀 있어요");
    }
  };

  const sendTest = () => {
    try {
      new Notification("옷을 찾을 때가 됐어요", { body: "브라우저 알림 예시예요" });
    } catch {
      toast("이 브라우저에서는 알림 창을 띄울 수 없어요");
    }
  };

  return (
    <Screen>
      <TopBar title="알림 설정" fallbackHref="/my" />

      <div className="mx-4 mt-2 overflow-hidden rounded-card-lg border border-line bg-card">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <span className="min-w-0 flex-1">
            <b className="block text-[15.5px] font-semibold">찾을 날짜 알림</b>
            <span className="mt-0.5 block text-caption text-sub">맡긴 옷을 찾을 때가 되면 알려 줘요.</span>
          </span>
          <Switch checked={settings.enabled} onChange={(v) => update({ enabled: v })} label="찾을 날짜 알림" />
        </div>

        <div className="border-b border-line px-4 py-3.5">
          <b className="block text-[15.5px] font-semibold">언제 알려 드릴까요?</b>
          <span className="mt-0.5 block text-caption text-sub">찾을 날짜가 지나면 계속 알려 드려요.</span>
          <div className="mt-3 flex gap-2">
            {LEADS.map((l) => (
              <Chip
                key={l.days}
                selected={settings.leadDays === l.days}
                className="flex-1 justify-center px-0"
                disabled={!settings.enabled}
                onClick={() => update({ leadDays: l.days })}
              >
                {l.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="min-w-0 flex-1">
            <b className="block text-[15.5px] font-semibold">브라우저 알림도 받기</b>
            <span className="mt-0.5 block text-caption text-sub">
              {perm === "unsupported"
                ? "이 브라우저는 알림을 지원하지 않아요."
                : perm === "denied"
                  ? "브라우저에서 알림이 막혀 있어요."
                  : "앱을 열어 둔 동안 알림 창으로 알려 줘요."}
            </span>
          </span>
          <Switch
            checked={settings.browser && perm === "granted"}
            onChange={toggleBrowser}
            label="브라우저 알림"
            disabled={!settings.enabled || perm === "unsupported"}
          />
        </div>
      </div>

      {settings.browser && perm === "granted" && settings.enabled && (
        <div className="px-4 pt-3">
          <Button variant="outline" size="sm" onClick={sendTest}>
            테스트 알림 보내기
          </Button>
        </div>
      )}

      <p className="px-5 pt-4 pb-6 text-[13px] leading-normal text-sub">
        앱을 닫아 두면 알림이 오지 않아요.
        <br />
        앱을 열면 홈의 벨 아이콘에서 확인할 수 있어요.
      </p>
    </Screen>
  );
}
