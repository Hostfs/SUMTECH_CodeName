import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../api'
import { useDaylight } from './daylight'
import { DEFAULT_PLACE, GEO_KEY, WeatherContext, fetchWeatherAt, toWeather, type Weather, type WeatherStatus, type WeatherValue } from './weather'

/**
 * 날씨를 앱 안에서 한 번만 불러 나눠 쓴다(디자인 초안 WeatherProvider와 같은 자리).
 * - 위치를 허락한 기기는 열자마자 현재 위치 날씨를 부른다.
 * - 아직 허락 전이면 기본 위치(광주창조경제혁신센터) 날씨를 먼저 보여 주고, '내 위치로 보기'로 바꾼다.
 * - 불러오지 못하면 지어낸 숫자 대신 '불러오지 못함'을 보여 준다(하늘은 시각으로 그린다).
 */
export function WeatherProvider({ children }: { children: ReactNode }) {
  const phase = useDaylight()
  const [weather, setWeather] = useState<Weather | null>(null)
  const [status, setStatus] = useState<WeatherStatus>('loading')
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')
  const alive = useRef(true)

  // 기본 위치 날씨. 이미 현재 위치 날씨를 받았으면 덮어쓰지 않는다.
  const fetchDefault = useCallback(() => {
    fetchWeatherAt(DEFAULT_PLACE.lat, DEFAULT_PLACE.lon)
      .then((w) => {
        if (!alive.current) return
        setWeather((prev) => (prev?.here ? prev : toWeather(w, DEFAULT_PLACE.name, false)))
        setStatus('ready')
      })
      .catch(() => { if (alive.current) setStatus((s) => (s === 'ready' ? s : 'error')) })
  }, [])

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('이 브라우저는 위치를 알려 주지 않아요.')
      return
    }
    setLocating(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        fetchWeatherAt(p.coords.latitude, p.coords.longitude)
          .then((w) => {
            if (!alive.current) return
            setWeather(toWeather(w, '현재 위치', true))
            setStatus('ready')
            try { localStorage.setItem(GEO_KEY, '1') } catch { /* 저장 못 해도 다음에 다시 물어보면 된다 */ }
          })
          .catch((e) => { if (alive.current) setGeoError(errorMessage(e)) })
          .finally(() => { if (alive.current) setLocating(false) })
      },
      (err) => {
        if (!alive.current) return
        setLocating(false)
        setGeoError(err.code === err.PERMISSION_DENIED ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용하면 현재 위치 날씨를 보여 드려요.' : '위치를 확인하지 못했어요. 잠시 뒤 다시 눌러 주세요.')
      },
      { timeout: 10_000, maximumAge: 10 * 60_000 },
    )
  }, [])

  const retry = useCallback(() => {
    setStatus('loading')
    fetchDefault()
  }, [fetchDefault])

  useEffect(() => {
    alive.current = true
    fetchDefault()
    // 한 번 허락한 기기는 바로 현재 위치로.
    const granted = (() => { try { return localStorage.getItem(GEO_KEY) === '1' } catch { return false } })()
    const perm = navigator.permissions?.query?.({ name: 'geolocation' as PermissionName })
    const allowed = perm ? perm.then((s) => s.state === 'granted').catch(() => granted) : Promise.resolve(granted)
    allowed.then((ok) => { if (ok && alive.current) locate() })
    // 30분마다 다시 부른다(초안과 같다).
    const every = window.setInterval(fetchDefault, 30 * 60_000)
    return () => { alive.current = false; window.clearInterval(every) }
  }, [fetchDefault, locate])

  const value = useMemo<WeatherValue>(() => ({ weather, status, phase, locating, geoError, locate, retry }),
    [weather, status, phase, locating, geoError, locate, retry])
  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>
}
