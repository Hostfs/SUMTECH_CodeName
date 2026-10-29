import { useEffect, useState } from 'react'
import type { SkyKind } from '../components/SkyScene'

/**
 * 하루의 때(서울 시각): 새벽 5~7시, 낮 7~17시, 노을 17~19시, 밤 19~5시.
 * 하늘 배경은 이 때와 날씨로 정하고, 밤에는 홈만이 아니라 앱 전체가 어두운 톤이 된다(디자인 초안: 화면을 오갈 때 밝기가 튀지 않게).
 */
export type Phase = 'dawn' | 'day' | 'dusk' | 'night'

export const PHASE_LABEL: Record<Phase, string> = { dawn: '새벽', day: '낮', dusk: '노을', night: '밤' }

function seoulHour(date: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Seoul' }).format(date))
}

export function phaseAt(date = new Date()): Phase {
  const h = seoulHour(date)
  if (h >= 5 && h < 7) return 'dawn'
  if (h >= 7 && h < 17) return 'day'
  if (h >= 17 && h < 19) return 'dusk'
  return 'night'
}

const isPhase = (v: unknown): v is Phase => v === 'dawn' || v === 'day' || v === 'dusk' || v === 'night'
const PREVIEW_KEY = 'ot.phase'

/** 하늘 미리보기: 주소의 ?phase=dusk 나 프로필 메뉴에서 고른 때(이 탭에서만). 없으면 실제 시각. */
function forcedPhase(): Phase | null {
  const q = new URLSearchParams(window.location.search).get('phase')
  if (isPhase(q)) return q
  try {
    const v = sessionStorage.getItem(PREVIEW_KEY)
    return isPhase(v) ? v : null
  } catch {
    return null
  }
}

export function previewPhase(): Phase | null {
  return forcedPhase()
}

export function setPreviewPhase(p: Phase | null) {
  try {
    if (p) sessionStorage.setItem(PREVIEW_KEY, p)
    else sessionStorage.removeItem(PREVIEW_KEY)
  } catch { /* 미리보기는 저장 못 해도 된다 */ }
  window.dispatchEvent(new Event('ot-phase'))
}

/** 지금의 때. 1분마다 다시 본다. */
export function useDaylight(): Phase {
  const [phase, setPhase] = useState<Phase>(() => forcedPhase() ?? phaseAt())
  useEffect(() => {
    const sync = () => setPhase(forcedPhase() ?? phaseAt())
    const t = window.setInterval(sync, 60_000)
    window.addEventListener('ot-phase', sync)
    return () => { window.clearInterval(t); window.removeEventListener('ot-phase', sync) }
  }, [])
  return forcedPhase() ?? phase
}

/** <html data-phase data-tone>: 밤이면 앱 전체를 어두운 톤으로. */
export function useDaylightTone(phase: Phase) {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.phase = phase
    root.dataset.tone = phase === 'night' ? 'dark' : 'light'
  }, [phase])
}

/** 날씨 종류 × 하루의 때 → 하늘 장면. 낮·저녁 장면은 초안 그대로이고, 새벽·깊은 밤을 더했다. */
export function sceneFor(kind: SkyKind, phase: Phase): string {
  if (phase === 'day') return `${kind}-day`
  if (phase === 'dawn') return kind === 'clear' || kind === 'cloudy' ? `${kind}-dawn` : `${kind}-day`
  if (phase === 'dusk') return kind === 'cloudy' ? 'cloudy-dusk' : `${kind}-night`
  if (kind === 'clear') return 'clear-late'
  if (kind === 'snow') return 'snow-late'
  return `${kind}-night`
}
