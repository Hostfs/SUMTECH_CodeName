// 회수 예정·기한 지남은 서비스 대상 지역(한국) 날짜로 계산한다. 날짜는 'YYYY-MM-DD' 문자열로 다룬다.

export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER'

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })

/** 서울 기준 오늘(또는 주어진 시각의 서울 날짜). */
export function today(at: Date = new Date()): string {
  return fmt.format(at)
}

export function plusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function currentSeason(): Season {
  const month = Number(today().slice(5, 7))
  if (month >= 3 && month <= 5) return 'SPRING'
  if (month >= 6 && month <= 8) return 'SUMMER'
  if (month >= 9 && month <= 11) return 'AUTUMN'
  return 'WINTER'
}

/** 'YYYY-MM-DD' 형식이고 실제 있는 날짜인지. */
export function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** JSON의 Instant 표기(Spring과 같은 ISO-8601 UTC). */
export function instant(v: Date | null | undefined): string | null {
  return v ? v.toISOString() : null
}
