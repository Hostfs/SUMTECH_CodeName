// 앱 색(계절 포인트 컬러): 기본은 서울 기준 이번 달(3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울). 프로필 메뉴에서 고정할 수 있다(디자인 초안의 '앱 테마').
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'
export type ThemeMode = 'auto' | SeasonKey

export const SEASON_LABEL: Record<SeasonKey, string> = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }
export const SEASON_SWATCH: Record<SeasonKey, string> = { spring: '#f4a9a6', summer: '#2ec4b0', autumn: '#ae7443', winter: '#1b4a82' }
const KEY = 'ot.theme'

export function seasonNow(date = new Date()): SeasonKey {
  const m = Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: 'Asia/Seoul' }).format(date))
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter'
}

export function themeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'spring' || v === 'summer' || v === 'autumn' || v === 'winter' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** <html data-season>에 적용한다. */
export function applyTheme(mode: ThemeMode = themeMode()) {
  document.documentElement.dataset.season = mode === 'auto' ? seasonNow() : mode
}

export function setThemeMode(mode: ThemeMode) {
  try {
    if (mode === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, mode)
  } catch { /* 이 기기에 못 남겨도 지금 화면에는 적용한다 */ }
  applyTheme(mode)
}
