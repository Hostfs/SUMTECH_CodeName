// 선 아이콘. 상태 아이콘은 세탁 표시 기호(세탁통·옷걸이)에서 모양을 가져왔다.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export const IconHanger = (p: P) => (
  <svg {...base} {...p}><path d="M12 7.2a2.2 2.2 0 1 1 2.2 2.2c-.9 0-1.6.7-1.6 1.6v.4l8.2 5.4c.8.5.4 1.7-.5 1.7H3.7c-.9 0-1.3-1.2-.5-1.7L11.4 11.4" /></svg>
)
export const IconBell = (p: P) => (
  <svg {...base} {...p}><path d="M6 10a6 6 0 1 1 12 0c0 4.2 1.6 6 2.2 6.6.2.2.1.6-.2.6H4c-.3 0-.4-.4-.2-.6C4.4 16 6 14.2 6 10Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></svg>
)
export const IconLogout = (p: P) => (
  <svg {...base} {...p}><path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M10 16l-4-4 4-4M6 12h9.5" /></svg>
)
export const IconEye = (p: P) => (
  <svg {...base} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></svg>
)
export const IconEyeOff = (p: P) => (
  <svg {...base} {...p}><path d="M4 4l16 16M9.9 6A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.6M6.4 7.6A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1M10 10.1a2.8 2.8 0 0 0 3.9 3.9" /></svg>
)
export const IconMap = (p: P) => (
  <svg {...base} {...p}><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M3.5 10h17M10 10v10M13.5 7h3" /></svg>
)
export const IconPlus = (p: P) => (
  <svg {...base} strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconShirt = (p: P) => (
  <svg {...base} {...p}><path d="M8.5 3.5 4 6l1.5 4.5L7.5 10v10.5h9V10l2 .5L20 6l-4.5-2.5c-.6 1.6-2 2.5-3.5 2.5s-2.9-.9-3.5-2.5Z" /></svg>
)
export const IconBox = (p: P) => (
  <svg {...base} {...p}><path d="M4 8h16v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V8Z" /><path d="M3 4.5h18V8H3zM9.5 12h5" /></svg>
)
export const IconSearch = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
)
export const IconPin = (p: P) => (
  <svg {...base} {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>
)
export const IconBack = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}><path d="m15 5-7 7 7 7" /></svg>
)
export const IconCamera = (p: P) => (
  <svg {...base} {...p}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" /><circle cx="12" cy="13" r="3.4" /></svg>
)
export const IconClose = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconAlert = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.3v.2" /></svg>
)
export const IconCheck = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
)
export const IconSparkle = (p: P) => (
  <svg {...base} {...p}><path d="M12 3.5 13.8 9 19.5 10.5 13.8 12 12 17.5 10.2 12 4.5 10.5 10.2 9Z" /><path d="M18.5 16.5v3M17 18h3" /></svg>
)
// 세탁 표시 기호: 물세탁(세탁통)
export const IconWash = (p: P) => (
  <svg {...base} {...p}><path d="M3 7.5 5 19h14l2-11.5" /><path d="M3.5 9.5c1.4 1 2.6 1 4 0s2.6-1 4 0 2.6 1 4 0 2.6-1 4 0" /></svg>
)
// 수선: 바늘과 실
export const IconNeedle = (p: P) => (
  <svg {...base} {...p}><path d="M19.5 4.5 7 17l-2.5 2.5" /><ellipse cx="18" cy="6" rx="1.2" ry="2.4" transform="rotate(45 18 6)" /><path d="M7 17c-2-1-3.5-3-3-5.5S8 8 9 10s-1 4.5 1 5.5" /></svg>
)
// 위치 확인 필요: 물음표 핀
export const IconPinQuestion = (p: P) => (
  <svg {...base} {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><path d="M10.2 8.6a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.5M12 14.2v.1" /></svg>
)
// 옮기기: 상자와 화살표
export const IconMove = (p: P) => (
  <svg {...base} {...p}><path d="M3.5 9h10v10.5h-10z" /><path d="M3.5 9 5.5 5h6l2 4" /><path d="M16 13h5M18.5 10.5 21 13l-2.5 2.5" /></svg>
)
export const IconBasket = (p: P) => (
  <svg {...base} {...p}><path d="M4 10h16l-1.6 9.2a1.5 1.5 0 0 1-1.5 1.3H7.1a1.5 1.5 0 0 1-1.5-1.3L4 10Z" /><path d="M8 10 11 4M16 10l-3-6" /></svg>
)
// 꺼내기: 상자에서 위로 나오는 화살표
export const IconTakeOut = (p: P) => (
  <svg {...base} {...p}><path d="M4 11h16v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5V11ZM2.5 11h19M12 3v10M8.5 6.5 12 3l3.5 3.5" /></svg>
)
