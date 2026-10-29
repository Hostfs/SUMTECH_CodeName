"use client";

import { useEffect } from "react";
import { useData } from "@/components/DataProvider";
import { dueDetail, dueItems, useNotifySettings } from "@/lib/notify";

const SENT_KEY = "closet.notified";
const CHECK_EVERY_MS = 15 * 60 * 1000;

function readSent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * 앱이 열려 있는 동안 찾을 때가 된 옷을 브라우저 알림 창으로 알린다.
 * 같은 옷·날짜·단계(알림 시작·당일·지남)는 한 번만 보낸다.
 * 서버가 없는 정적 사이트라 앱을 닫아 두면 알림이 오지 않는다 (알림 설정 화면에 안내한다).
 */
export function NotificationWatcher() {
  const { ready, garments } = useData();
  const [settings] = useNotifySettings();

  useEffect(() => {
    if (!ready || !settings.enabled || !settings.browser) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const check = () => {
      const items = dueItems(garments, settings.leadDays);
      const sent = new Set(readSent());
      let changed = false;
      for (const item of items) {
        if (sent.has(item.key)) continue;
        try {
          new Notification("옷을 찾을 때가 됐어요", { body: `${item.garment.name} · ${dueDetail(item)}`, tag: item.key });
        } catch {
          continue; // 이 브라우저는 알림 창을 만들 수 없다
        }
        sent.add(item.key);
        changed = true;
      }
      if (changed) {
        try {
          localStorage.setItem(SENT_KEY, JSON.stringify([...sent].slice(-200)));
        } catch {}
      }
    };

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, garments, settings.enabled, settings.browser, settings.leadDays]);

  return null;
}
