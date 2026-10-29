// 회수 예정일을 휴대폰·PC 달력으로 넘기는 일정 파일(.ics). 앱을 열지 않는 날에도 달력이 '무엇을 찾아올지' 알려 준다.
import type { BoardItem } from './types'

/** iCalendar 글자 규칙: \ ; , 줄바꿈을 이스케이프한다. */
function esc(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** 75바이트를 넘는 줄은 접는다(RFC 5545). 한글은 3바이트라 글자 수로 넉넉히 자른다. */
function fold(line: string) {
  const out: string[] = []
  let rest = line
  while (rest.length > 40) {
    out.push(rest.slice(0, 40))
    rest = ` ${rest.slice(40)}`
  }
  out.push(rest)
  return out.join('\r\n')
}

const ymd = (date: string) => date.replaceAll('-', '')

/** 회수 예정일 오전 9시(기기 시간대)에 30분짜리 일정과 알림. */
export function careIcs(item: BoardItem, origin: string): string {
  const { care, garment } = item
  const day = ymd(care.dueOn!)
  const where = care.shopName ?? care.placeLabel
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//otgyeol//care//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:otgyeol-care-${care.id}@${new URL(origin).hostname}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${day}T090000`,
    `DTEND:${day}T093000`,
    `SUMMARY:${esc(`옷결 회수 · ${garment.name}`)}`,
    `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc(`${where}에 ${care.careTypeLabel} 맡긴 ${garment.name}을(를) 찾아오는 날이에요. 찾은 뒤 옷결 관리함에서 '회수 완료'를 눌러 주세요.\n${origin}/care`)}`,
    `URL:${origin}/care`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`오늘 ${garment.name} 찾아오는 날`)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** 일정 파일을 내려받는다. 휴대폰에서 열면 기본 달력 앱이 '추가'를 묻는다. */
export function downloadCareIcs(item: BoardItem) {
  const blob = new Blob([careIcs(item, window.location.origin)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `옷결-회수-${item.garment.name}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
