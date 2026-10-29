import { createContext, useContext } from 'react'
import { api } from '../api'
import type { Weather as ApiWeather } from '../types'
import type { SkyKind } from '../components/SkyScene'
import type { Phase } from './daylight'

/**
 * 홈 하늘의 날씨(F11, 기상청 단기예보). 디자인 초안(otgyeol-frontend)의 WeatherProvider와 같은 자리.
 * 화면 부품은 WeatherProvider.tsx, 여기에는 자료 모양·불러오기·옷결의 한마디만 둔다.
 */
export const DEFAULT_PLACE = { name: '광주창조경제혁신센터', lat: 35.1534, lon: 126.8901 }
export const GEO_KEY = 'ot.geo'

export interface Weather {
  place: string
  /** 현재 위치로 부른 날씨인지 */
  here: boolean
  kind: SkyKind
  label: string
  temp: number
  humidity: number | null
  hi: number | null
  lo: number | null
  pop: number | null
  raw: ApiWeather
}

/** off: 서버에 기상청 키가 없어(503) 날씨를 쓸 수 없는 환경. 다시 불러도 소용없다. */
export type WeatherStatus = 'loading' | 'ready' | 'error' | 'off'

export interface WeatherValue {
  weather: Weather | null
  status: WeatherStatus
  phase: Phase
  /** 위치 확인 중 */
  locating: boolean
  /** 위치를 못 받았을 때의 안내 */
  geoError: string
  locate: () => void
  retry: () => void
}

export const WeatherContext = createContext<WeatherValue | null>(null)

export function useWeather(): WeatherValue {
  const v = useContext(WeatherContext)
  if (!v) throw new Error('WeatherProvider 안에서만 쓸 수 있어요')
  return v
}

function kindOf(w: ApiWeather): SkyKind {
  if (w.raining) return /눈/.test(w.precipitation) && !/비/.test(w.precipitation) ? 'snow' : 'rain'
  return w.sky === '맑음' ? 'clear' : 'cloudy'
}

export function toWeather(w: ApiWeather, place: string, here: boolean): Weather {
  // 기온이 비어 오면 숫자를 지어내지 않고 '불러오지 못함'으로 본다.
  if (w.temperature == null) throw new Error('기온 없음')
  const kind = kindOf(w)
  return {
    place, here, kind,
    label: w.raining ? w.precipitation : w.sky ?? '흐림',
    temp: Math.round(w.temperature),
    humidity: w.humidity ?? null,
    hi: w.maxTemperature == null ? null : Math.round(w.maxTemperature),
    lo: w.minTemperature == null ? null : Math.round(w.minTemperature),
    pop: w.rainChance ?? null,
    raw: w,
  }
}

export const fetchWeatherAt = (lat: number, lon: number) =>
  api.get<ApiWeather>(`/api/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)

/** 기상청 일 최고기온은 15시, 최저기온은 6시 기준이다. */
export const HI_AT = '오후 3시'
export const LO_AT = '오전 6시'

// ---- 옷결의 한마디(디자인 초안 adviceFor 그대로) ----
export interface Advice { line1: string; before: string; key: string; after: string }

export function adviceFor(w: Weather): Advice {
  const t = w.temp
  const swing = w.hi != null && w.lo != null ? w.hi - w.lo : 0
  const pop = w.pop ?? 0

  if (w.kind === 'snow') {
    return t <= 2
      ? { line1: '눈이 내리고 영하로 떨어졌어요.', before: '', key: '패딩과 목도리', after: '까지 꼭 챙기세요.' }
      : { line1: '눈이 내리고 있어요.', before: '', key: '방수되는 신발', after: '을 신어 보세요.' }
  }
  if (w.kind === 'rain' || pop >= 60) {
    return {
      line1: w.kind === 'rain' ? '지금 비가 내리고 있어요.' : `오늘 비 올 확률이 ${pop}%예요.`,
      before: '',
      key: t <= 10 ? '따뜻한 방수 겉옷' : '우산과 가벼운 겉옷',
      after: '을 챙겨 보세요.',
    }
  }
  if (swing >= 10 && t >= 14 && t <= 22) {
    return { line1: `하루 기온 차가 ${swing}°로 커요.`, before: '', key: '벗기 쉬운 겉옷', after: '을 챙겨 보세요.' }
  }
  if (t <= 5) return { line1: '오늘은 꽤 추워요.', before: '', key: '패딩이나 롱코트', after: '로 단단히 입으세요.' }
  if (t <= 9) return { line1: '오늘은 날씨가 쌀쌀하니', before: '', key: '두꺼운 겉옷', after: '을 입는 건 어떨까요?' }
  if (t <= 13) return { line1: '아침저녁으로 쌀쌀해요.', before: '', key: '도톰한 겉옷', after: '을 챙겨 볼까요?' }
  if (t <= 17) return { line1: '선선한 날씨예요.', before: '', key: '얇은 겉옷', after: ' 하나면 충분해요.' }
  if (t <= 22) return { line1: '포근한 날씨예요.', before: '', key: '긴팔 한 장', after: '이면 딱 좋아요.' }
  if (t <= 27) return { line1: '따뜻한 날씨예요.', before: '', key: '가벼운 반팔', after: '을 입어 보세요.' }
  return { line1: '꽤 더워요.', before: '', key: '시원한 린넨 소재', after: '로 입어 보세요.' }
}
