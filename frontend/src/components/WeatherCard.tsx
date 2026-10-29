import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import type { GarmentSummary, Weather } from '../types'
import { isNight, pickForWeather, sceneOf, type Scene } from '../weatherPicks'
import GarmentArt from './GarmentArt'
import { Precip, Sky as SkyScene, type SkyKind } from './SkyScene'
import { IconPin, IconShirt } from './Icons'
import { Spinner } from './Ui'

// 한 번 위치를 허락하면 다음부터는 옷장을 열 때 바로 불러온다(이 기기에서만).
const CONSENT = 'otgyeol.weather'

function remembered(): boolean {
  try {
    return localStorage.getItem(CONSENT) === 'on'
  } catch {
    return false
  }
}
function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(CONSENT, 'on')
    else localStorage.removeItem(CONSENT)
  } catch {
    // 저장소를 못 써도 이번 화면에서는 동작한다.
  }
}

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 브라우저는 위치를 지원하지 않아요.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(
      e.code === e.PERMISSION_DENIED ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 허락하면 날씨를 볼 수 있어요.' : '현재 위치를 찾지 못했어요.',
    )), { timeout: 10_000, maximumAge: 10 * 60_000 })
  })
}

const deg = (n: number | null) => (n === null ? '–' : `${Math.round(n)}°`)

/** 선 아이콘(24 그리드). 디자인 시스템의 날씨 아이콘과 같은 모양. */
function WxIcon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    sun: <><circle cx="12" cy="12" r="4" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M12 2.5v2.2" transform={`rotate(${a} 12 12)`} />)}</>,
    moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
    cloud: <path d="M7 18h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.3A3.4 3.4 0 0 0 7 18Z" />,
    partly: <><path d="M8.5 6.2A4 4 0 0 1 14.6 9" /><path d="M5.5 4.8 4.6 3.9M8 3V2M3.5 8.5h-1" /><path d="M8 19h9a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.2A3 3 0 0 0 8 19Z" /></>,
    rain: <><path d="M7 15h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.3A3.4 3.4 0 0 0 7 15Z" /><path d="m9 18-1 2.5M13 18l-1 2.5M17 18l-1 2.5" /></>,
    snow: <><path d="M7 15h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.3A3.4 3.4 0 0 0 7 15Z" /><path d="M8.5 19h.01M12 20.5h.01M15.5 19h.01" /></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name] ?? paths.cloud}
    </svg>
  )
}

function bigIcon(scene: Scene, night: boolean) {
  if (scene === 'clear') return night ? 'moon' : 'sun'
  if (scene === 'cloudy') return 'partly'
  return scene === 'overcast' ? 'cloud' : scene
}

/** 기상청 장면(맑음·구름 많음·흐림·비·눈)을 초안 하늘의 장면 이름으로 바꾼다. */
function skyKind(scene: Scene): SkyKind {
  if (scene === 'clear') return 'clear'
  if (scene === 'rain' || scene === 'snow') return scene
  return 'cloudy'
}

/**
 * 화면 위쪽에 넓게 까는 날씨 배경. 기상청 실황(하늘 상태·강수)과 밤낮에 따라
 * 맑은 낮·노을 진 밤·구름·비·눈 하늘로 바뀐다(그림은 프론트엔드 초안의 하늘).
 */
function Sky({ scene, night }: { scene: Scene; night: boolean }) {
  const kind = skyKind(scene)
  return (
    <div className={`wx-sky wx-sky-${scene}${night ? ' night' : ''}`} aria-hidden>
      <SkyScene scene={`${kind}-${night ? 'night' : 'day'}`} />
      <Precip kind={kind} />
    </div>
  )
}

function dateLabel() {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date())
}

/** 홈 위쪽: 현재 위치 날씨와 지금 꺼낼 수 있는 옷(R12). 배경은 날씨·밤낮에 따라 바뀐다.
 *  날씨를 받기 전에는 구름 낀 하늘(밤이면 밤하늘)을 깔아 둔다. */
export default function WeatherCard({ items }: { items: GarmentSummary[] }) {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const night = useMemo(() => isNight(), [])

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const p = await position()
      remember(true)
      const w = await api.get<Weather>(`/api/weather?lat=${p.coords.latitude.toFixed(4)}&lon=${p.coords.longitude.toFixed(4)}`)
      setWeather(w)
      setState('idle')
    } catch (e) {
      if (e instanceof Error && /권한/.test(e.message)) remember(false)
      setError(errorMessage(e))
      setState('error')
    }
  }, [])

  useEffect(() => {
    if (!remembered()) return
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const result = useMemo(() => (weather ? pickForWeather(items, weather) : null), [items, weather])

  // 받은 날씨를 화면 전체에 알린다: <html data-wx="rain-night"> → 하늘 배경과 그 위 제목·버튼 색이 날씨·밤낮에 맞춰 바뀐다.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.wx = `${weather ? sceneOf(weather) : 'cloudy'}${night ? '-night' : ''}`
    return () => { delete root.dataset.wx }
  }, [weather, night])

  if (!weather || !result) {
    return (
      <>
      <Sky scene="cloudy" night={night} />
      <section className="wx-card wx-empty" aria-label="오늘 날씨">
        <span className="wx-tip-icon"><WxIcon name={night ? 'moon' : 'sun'} size={20} /></span>
        <div className="wx-empty-text">
          <strong>오늘 날씨에 맞는 옷, 어디 있는지까지</strong>
          <p>{state === 'error' ? error : '현재 위치의 기상청 날씨로, 지금 집에서 바로 꺼낼 수 있는 옷을 골라 드려요.'}</p>
        </div>
        <button type="button" className="btn btn-sm" onClick={load} disabled={state === 'loading'}>
          {state === 'loading' && <Spinner />}{state === 'error' ? '다시 시도' : '현재 위치 날씨 보기'}
        </button>
      </section>
      </>
    )
  }

  const scene = sceneOf(weather)
  const condition = weather.raining ? weather.precipitation : weather.sky ?? '날씨'
  const range = [weather.maxTemperature !== null && `최고 ${deg(weather.maxTemperature)}`, weather.minTemperature !== null && `최저 ${deg(weather.minTemperature)}`].filter(Boolean).join(' · ')
  const tip = result.tips[0] ?? `${weather.seasonReason}, ${weather.seasonLabels.join('·')} 옷이 맞아요.`

  return (
    <>
      <Sky scene={scene} night={night} />
      <section className="wx-card wx-hero" aria-label="오늘 날씨" data-scene={scene} data-night={night ? 'true' : undefined}>
        <div className="wx-head">
          <b><IconPin />현재 위치</b>
          <span>{dateLabel()}</span>
          <button type="button" className="wx-refresh" onClick={load} disabled={state === 'loading'} aria-label="날씨 새로고침">
            {state === 'loading' ? <Spinner /> : '새로고침'}
          </button>
        </div>
        <div className="wx-now">
          <div className="wx-temp">{deg(weather.temperature)}</div>
          <div className="wx-cond">
            <div>
              <b>{condition}</b>
              <span>{range}{weather.rainChance !== null ? `${range ? ' · ' : ''}강수 ${weather.rainChance}%` : ''}</span>
            </div>
            <span className="wx-big"><WxIcon name={bigIcon(scene, night)} size={40} /></span>
          </div>
        </div>
        {weather.hours.length > 1 && (
          <ul className="wx-hours" aria-label="시간대 예보">
            {weather.hours.map((h) => (
              <li key={h.label}>
                <span>{h.label}</span>
                <WxIcon name={h.icon} />
                <b>{deg(h.temperature)}</b>
              </li>
            ))}
          </ul>
        )}
        <div className="wx-tip">
          <span className="wx-tip-icon"><IconShirt /></span>
          <p><small>옷결의 한마디</small>{tip}{result.tips.length > 1 && <><br />{result.tips[1]}</>}</p>
        </div>
        <p className="wx-src">기상청 {weather.observedAt} 관측{weather.humidity !== null ? ` · 습도 ${weather.humidity}%` : ''}</p>
      </section>

      <section className="wx-picks" role="group" aria-label="옷장에서 바로 꺼내기">
        <h2 className="section-title">옷장에서 바로 꺼내기<small>{weather.seasonReason}, 지금 집에 있는 {weather.seasonLabels.join('·')} 옷</small></h2>
        {result.picks.length === 0 ? (
          <p className="wx-none">이 기온에 맞는 {weather.seasonLabels.join('·')} 옷 중 지금 집 안에 배치된 옷이 없어요. 옷의 계절을 정하거나 옷장 지도에서 배치해 보세요.</p>
        ) : (
          <ul>
            {result.picks.map(({ garment: g, reason }) => (
              <li key={g.id}>
                <Link to={`/closet/${g.id}`} className="wx-pick">
                  <span className="row-thumb">{g.imageUrl ? <img src={g.imageUrl} alt="" /> : <GarmentArt subType={g.subType} colorHex={g.colorHex} title={g.name} />}</span>
                  <span className="wx-pick-text">
                    <span className="wx-pick-reason">{reason}</span>
                    <span className="wx-pick-name">{g.name}</span>
                    <span className="wx-pick-loc"><IconPin />{g.locationPath}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
