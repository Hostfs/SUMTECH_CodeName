import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import type { GarmentSummary, Weather } from '../types'
import { isNight, pickForWeather, sceneOf, type Scene } from '../weatherPicks'
import GarmentArt from './GarmentArt'
import { IconPin } from './Icons'
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

function WeatherIcon({ scene, night }: { scene: Scene; night: boolean }) {
  return (
    <svg className="wx-icon" viewBox="0 0 64 64" aria-hidden>
      {scene === 'clear' && (night
        ? <path d="M40 12a20 20 0 1 0 12 32A16 16 0 0 1 40 12Z" fill="currentColor" />
        : <><circle cx="32" cy="32" r="12" fill="currentColor" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="32" y1="9" x2="32" y2="15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" transform={`rotate(${a} 32 32)`} />
        ))}</>)}
      {scene !== 'clear' && <path d="M20 42a10 10 0 0 1 1-20 13 13 0 0 1 24 3 8.5 8.5 0 0 1 1 17Z" fill="currentColor" />}
      {scene === 'rain' && [22, 32, 42].map((x) => <line key={x} x1={x} y1="48" x2={x - 3} y2="56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />)}
      {scene === 'snow' && [22, 32, 42].map((x) => <circle key={x} cx={x} cy="53" r="2.5" fill="currentColor" />)}
    </svg>
  )
}

/** 내 옷장 맨 위: 현재 위치 날씨와 지금 꺼낼 수 있는 옷(R12). 배경은 날씨·밤낮에 따라 바뀐다. */
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

  if (!weather || !result) {
    return (
      <section className="wx wx-empty" aria-label="오늘 날씨">
        <div>
          <strong>오늘 날씨에 맞는 옷, 어디 있는지까지</strong>
          <p>{state === 'error' ? error : '현재 위치의 기상청 날씨로, 지금 집에서 바로 꺼낼 수 있는 옷을 골라 드려요.'}</p>
        </div>
        <button type="button" className="btn btn-sm" onClick={load} disabled={state === 'loading'}>
          {state === 'loading' && <Spinner />}{state === 'error' ? '다시 시도' : '현재 위치 날씨 보기'}
        </button>
      </section>
    )
  }

  const scene = sceneOf(weather)
  const temp = weather.temperature !== null ? Math.round(weather.temperature) : null
  const condition = weather.raining ? weather.precipitation : weather.sky ?? '날씨'
  const range = [weather.minTemperature !== null && `최저 ${Math.round(weather.minTemperature)}°`, weather.maxTemperature !== null && `최고 ${Math.round(weather.maxTemperature)}°`].filter(Boolean).join(' / ')

  return (
    <section className={`wx wx-${scene}${night ? ' night' : ''}`} aria-label="오늘 날씨" data-scene={scene}>
      <div className="wx-now">
        <WeatherIcon scene={scene} night={night} />
        <div className="wx-temp">{temp !== null ? `${temp}°` : '–'}</div>
        <div className="wx-text">
          <strong>{condition}</strong>
          <span>{[range, weather.rainChance !== null && `강수확률 ${weather.rainChance}%`].filter(Boolean).join(', ')}</span>
          <span className="wx-src">기상청 {weather.observedAt} 관측{weather.humidity !== null ? `, 습도 ${weather.humidity}%` : ''}</span>
        </div>
        <button type="button" className="wx-refresh" onClick={load} disabled={state === 'loading'} aria-label="날씨 새로고침">
          {state === 'loading' ? <Spinner /> : '새로고침'}
        </button>
      </div>
      {result.tips.length > 0 && <ul className="wx-tips">{result.tips.map((t) => <li key={t}>{t}</li>)}</ul>}

      <div className="wx-picks" role="group" aria-label="옷장에서 바로 꺼내기">
        <h2>옷장에서 바로 꺼내기 <small>{weather.seasonReason}, {weather.seasonLabels.join('·')} 옷 중 지금 집에 있는 옷</small></h2>
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
      </div>
    </section>
  )
}
