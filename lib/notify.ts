"use client";

import { useCallback, useSyncExternalStore } from "react";
import { OUTING_LABEL } from "./outing";
import type { Garment } from "./types";

/** 세탁·수선 찾을 날짜 알림 설정 (이 기기에만 저장) */
export interface NotifySettings {
  /** 앱 안 알림(홈 벨 배지와 알림 목록) */
  enabled: boolean;
  /** 찾을 날짜 며칠 전부터 알릴지. 0 = 당일부터 */
  leadDays: 0 | 1 | 2 | 3;
  /** 앱을 열어 둔 동안 브라우저 알림 창으로도 알린다 */
  browser: boolean;
}

export const DEFAULT_NOTIFY: NotifySettings = { enabled: true, leadDays: 1, browser: false };

const KEY = "closet.notify";
let cache: NotifySettings | null = null;
const listeners = new Set<() => void>();

function read(): NotifySettings {
  if (cache) return cache;
  let parsed: Partial<NotifySettings> = {};
  try {
    parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<NotifySettings>;
  } catch {}
  cache = { ...DEFAULT_NOTIFY, ...parsed };
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useNotifySettings(): [NotifySettings, (patch: Partial<NotifySettings>) => void] {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULT_NOTIFY);
  const update = useCallback((patch: Partial<NotifySettings>) => {
    cache = { ...read(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {}
    listeners.forEach((l) => l());
  }, []);
  return [settings, update];
}

// ── 찾을 때가 된 옷 ──

export type DueStage = "overdue" | "today" | "soon";

export interface DueItem {
  garment: Garment;
  stage: DueStage;
  /** 찾을 날짜까지 남은 날. 지났으면 음수 */
  daysLeft: number;
  /** 같은 알림을 두 번 보내지 않기 위한 키 */
  key: string;
}

export function seoulToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** 맡겨 둔 옷 중 찾을 날짜가 지났거나, 오늘이거나, 알림 시작일(leadDays 전)이 된 것. 급한 순서로. */
export function dueItems(garments: Garment[], leadDays: number, today = seoulToday()): DueItem[] {
  const items: DueItem[] = [];
  for (const g of garments) {
    const due = g.outing?.dueDate;
    if (!due) continue;
    const daysLeft = daysBetween(today, due);
    if (daysLeft > leadDays) continue;
    const stage: DueStage = daysLeft < 0 ? "overdue" : daysLeft === 0 ? "today" : "soon";
    items.push({ garment: g, stage, daysLeft, key: `${g.id}|${due}|${stage}` });
  }
  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** 알림 문구. 예: '세탁을 찾는 날이에요' */
export function dueMessage(item: DueItem): string {
  const kind = OUTING_LABEL[item.garment.outing!.kind];
  if (item.stage === "overdue") return `${kind} 찾을 날짜가 ${-item.daysLeft}일 지났어요`;
  if (item.stage === "today") return `오늘 ${kind}을 찾는 날이에요`;
  return item.daysLeft === 1 ? `내일 ${kind}을 찾아요` : `${item.daysLeft}일 뒤에 ${kind}을 찾아요`;
}

export function dueDetail(item: DueItem): string {
  const shop = item.garment.outing?.shop;
  return shop ? `${dueMessage(item)} · ${shop}` : dueMessage(item);
}
