import type { GarmentSummary, Weather } from './types'

/** 카드 배경을 정하는 날씨 장면. 밤(19~6시)은 따로 표시한다. */
export type Scene = 'clear' | 'cloudy' | 'overcast' | 'rain' | 'snow'

export function sceneOf(w: Weather): Scene {
  if (w.raining) return /눈/.test(w.precipitation) && !/비/.test(w.precipitation) ? 'snow' : 'rain'
  if (w.sky === '맑음') return 'clear'
  if (w.sky === '흐림') return 'overcast'
  return 'cloudy'
}

export function isNight(date = new Date()): boolean {
  const h = date.getHours()
  return h >= 19 || h < 6
}

export type Pick = { garment: GarmentSummary; reason: string }

const MAX_PICKS = 4

/**
 * 날씨에 맞춰 지금 집 안에 있어 바로 꺼낼 수 있는 옷을 고른다(R12). 규칙은 화면에 이유로 그대로 보여 준다.
 * - 기온 기준표로 정한 계절(서버의 seasons)에 맞는 옷만 고른다.
 * - 비·눈이 오거나 강수확률 60% 이상, 또는 5°C 미만이면 아우터를 먼저 고른다.
 * - 오늘 최고 28°C 이상이면 아우터를 뺀다. 일교차가 10°C 이상이면 아우터를 하나 넣는다.
 */
export function pickForWeather(items: GarmentSummary[], w: Weather): { picks: Pick[]; tips: string[] } {
  const high = w.maxTemperature ?? w.temperature
  const low = w.minTemperature ?? w.temperature
  const wet = w.raining || (w.rainChance ?? 0) >= 60
  const cold = low !== null && low < 5
  const hot = high !== null && high >= 28
  const swing = w.maxTemperature !== null && w.minTemperature !== null ? Math.round(w.maxTemperature - w.minTemperature) : 0
  const season = w.seasonLabels.join('·')

  let order = ['TOP', 'BOTTOM', 'OUTER', 'DRESS', 'ETC']
  if (wet || cold) order = ['OUTER', ...order.filter((c) => c !== 'OUTER')]
  if (hot) order = order.filter((c) => c !== 'OUTER')

  const reasonFor = (category: string): string => {
    if (category === 'OUTER') {
      if (w.raining) return `${w.precipitation} 오는 중이라 겉옷부터`
      if (wet) return `강수확률 ${w.rainChance}%라 겉옷부터`
      if (cold) return `최저 ${Math.round(low!)}°라 겉옷부터`
      if (swing >= 10) return `일교차 ${swing}°라 걸칠 겉옷`
    }
    return `${season} 옷`
  }

  const usable = items.filter((g) => g.locationKind === 'HOME' && g.status === 'STORED' && g.seasons.some((s) => w.seasons.includes(s)))
  const picks: Pick[] = []
  for (const category of order) {
    const g = usable.find((x) => x.category === category)
    if (g) picks.push({ garment: g, reason: reasonFor(category) })
    if (picks.length === MAX_PICKS) break
  }

  const tips: string[] = []
  if (wet && !/눈/.test(w.precipitation)) tips.push('우산을 챙기고, 젖어도 괜찮은 신발을 신으세요.')
  if (/눈/.test(w.precipitation)) tips.push('눈이 와요. 미끄럽지 않은 신발을 신으세요.')
  if (swing >= 10 && !hot) tips.push(`일교차가 ${swing}°예요. 아침저녁에는 쌀쌀해요.`)
  if (hot) tips.push('더운 날이라 겉옷은 뺐어요.')
  return { picks, tips }
}
