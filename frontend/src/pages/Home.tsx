import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import GarmentArt from '../components/GarmentArt'
import { Icon, type IconName } from '../components/Icon'
import { Precip, Sky } from '../components/SkyScene'
import { sceneFor } from '../lib/daylight'
import TopBar from '../components/TopBar'
import { Notice } from '../components/Ui'
import { HI_AT, LO_AT, adviceFor, useWeather } from '../lib/weather'
import { seasonNow } from '../lib/season'
import { isGuest, useSession } from '../session'
import type { GarmentSummary } from '../types'
import { pickForWeather } from '../weatherPicks'
import '../styles/home.app.css'

const KIND_ICON: Record<string, IconName> = { clear: 'sun', cloudy: 'cloud', rain: 'rain', snow: 'snow' }
const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const SEASON_CODE = { spring: 'SPRING', summer: 'SUMMER', autumn: 'AUTUMN', winter: 'WINTER' } as const

function today() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAYS[d.getDay()]}요일`
}

const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n))
const wearable = (g: GarmentSummary) => g.locationKind === 'HOME' && g.usable

const WHERE: { kind: GarmentSummary['locationKind']; label: string }[] = [
  { kind: 'HOME', label: '집 안' },
  { kind: 'BOX', label: '박스 속' },
  { kind: 'OFFSITE', label: '집 밖' },
  { kind: 'CARE', label: '세탁·수선 맡김' },
  { kind: 'UNPLACED', label: '미배치' },
]

/**
 * 로그인 후 첫 화면(디자인 초안 otgyeol-frontend Home 그대로): 인사, 날씨 하늘(시간대·기상청 실황), 오늘 기온,
 * 옷결의 한마디, 옷장에서 바로 꺼내기(지금 집 안에 있는 옷만, 위치 경로와 함께).
 * PC는 같은 부품을 하늘 위 두 단으로 펼치고, 옷이 지금 어디에 나뉘어 있는지도 함께 보여 준다.
 */
export default function Home() {
  const { me } = useSession()
  const { weather, status, phase, locating, geoError, locate, retry } = useWeather()
  const [garments, setGarments] = useState<GarmentSummary[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<GarmentSummary[]>('/api/garments').then(setGarments).catch((e) => setError(errorMessage(e)))
  }, [])

  const scene = sceneFor(weather?.kind ?? 'clear', phase)
  const icon: IconName = weather ? (weather.kind === 'clear' && (phase === 'night' || phase === 'dusk') ? 'moon' : KIND_ICON[weather.kind]) : 'cloudSun'
  const advice = weather ? adviceFor(weather) : null

  // 옷장에서 바로 꺼내기: 날씨가 있으면 날씨 규칙(F11), 없으면 이번 계절 옷 중 집 안에 있는 옷.
  const picks = useMemo(() => {
    if (!garments) return []
    if (weather) return pickForWeather(garments, weather.raw).picks.map((p) => p.garment)
    const season = SEASON_CODE[seasonNow()]
    return garments.filter((g) => wearable(g) && g.seasons.includes(season)).slice(0, 4)
  }, [garments, weather])

  const where = useMemo(() => WHERE.map(({ kind, label }) => {
    const list = (garments ?? []).filter((g) => g.locationKind === kind)
    return { kind, label, count: list.length, names: list.slice(0, 2).map((g) => g.name) }
  }).filter((r) => r.count > 0), [garments])

  const name = isGuest(me) ? '게스트' : (me?.email ?? '').split('@')[0]
  const sub: [string, string] | null = weather
    ? weather.humidity != null ? ['습도', `${weather.humidity}%`] : ['기상청', '실황']
    : null

  return (
    <div className={`home${status === 'loading' && !weather ? ' is-loading' : ''}`} data-phase={phase}>
      <header className="home-head">
        <div>
          <p className="home-date">{today()}</p>
          <p className="home-hello">안녕하세요,</p>
          <h1 className="home-name">{name}<span>님</span></h1>
          <p className="home-account">{isGuest(me) ? '게스트로 체험 중이에요' : me?.email}</p>
        </div>
        <TopBar />
      </header>

      <div className="home-sky" key={scene}>
        <Sky scene={scene} />
        <Precip kind={weather?.kind ?? 'clear'} />
        <div className="sky-scrim" />
      </div>
      <div className="home-fade-top" />

      <section className="wx" aria-label="오늘의 날씨">
        <div className="wx-now">
          <p className="wx-loc">
            <Icon name="pin" size={14} />
            {weather?.place ?? '광주창조경제혁신센터'}
            {!weather?.here && (
              <button type="button" className="wx-locate" onClick={locate} disabled={locating}>
                {locating ? '위치 확인 중…' : '내 위치로 보기'}
              </button>
            )}
          </p>
          {geoError && <p className="wx-geo-error">{geoError}</p>}
          <p className="wx-cond">
            <Icon name={icon} size={18} />
            {weather ? weather.label : status === 'error' ? '날씨를 불러오지 못했어요' : '날씨를 불러오고 있어요'}
            {status === 'error' && !weather && <button type="button" className="wx-retry" onClick={retry}>다시 불러오기</button>}
          </p>

          {weather && (
            <>
              <div className="wx-main">
                <div className="wx-temp" aria-label={`현재 기온 ${weather.temp}도`}>
                  {weather.temp < 0 && <span className="neg">−</span>}
                  {Math.abs(weather.temp)}
                  <sup>°</sup>
                </div>
                {sub && <p className="wx-sub">{sub[0]}<b>{sub[1]}</b></p>}
              </div>

              <dl className="wx-stats">
                {weather.hi != null && (
                  <div>
                    <dt>최고 <b>{signed(weather.hi)}°</b></dt>
                    <dd>{HI_AT}</dd>
                  </div>
                )}
                {weather.lo != null && (
                  <div>
                    <dt>최저 <b>{signed(weather.lo)}°</b></dt>
                    <dd>{LO_AT}</dd>
                  </div>
                )}
                {weather.pop != null && (
                  <div>
                    <dt><Icon name="drop" size={13} stroke={2} /> 강수확률</dt>
                    <dd className="big">{weather.pop}%</dd>
                  </div>
                )}
              </dl>
            </>
          )}

          {advice && (
            <div className="advice">
              <p className="advice-eyebrow"><Icon name="sparkle" size={13} />옷결의 한마디</p>
              <p className="advice-text">
                {advice.line1}
                <br />
                {advice.before}<em>{advice.key}</em>{advice.after}
              </p>
            </div>
          )}
        </div>

        <div className="wx-side">
          {error && <Notice>{error}</Notice>}

          {garments && garments.length === 0 && (
            <div className="empty home-empty">
              <p className="empty-title">등록된 옷이 0벌이에요</p>
              <p>새로 산 옷이나 오늘 입은 옷부터 한 벌씩 등록해 보세요. 택을 찍으면 브랜드와 세탁법을 읽어 드려요.</p>
              <Link className="btn btn-primary" to="/register">옷 등록</Link>
            </div>
          )}

          {picks.length > 0 && (
            <div className="recs">
              <div className="recs-head">
                <span>옷장에서 바로 꺼내기</span>
                <Link to="/closet">전체 보기 ›</Link>
              </div>
              <div className="recs-row">
                {picks.map((g) => (
                  <Link key={g.id} to={`/closet/${g.id}`} className="rec">
                    <span className="rec-tile">
                      {g.imageUrl ? <img src={g.imageUrl} alt="" /> : <GarmentArt subType={g.subType} colorHex={g.colorHex} size={34} />}
                    </span>
                    <span className="rec-text">
                      <b>{g.name}</b>
                      <small><Icon name="pin" size={11} stroke={2} />{g.locationPath ?? '집 안'}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {where.length > 0 && (
            <section className="home-where" aria-label="지금 내 옷은 어디에">
              <div className="recs-head">
                <span>지금 내 옷은 어디에</span>
                <Link to="/closet?view=where">나눠 보기 ›</Link>
              </div>
              <ul className="where-list">
                {where.map((r) => (
                  <li key={r.kind}>
                    <span className={`where-dot where-${r.kind}`} aria-hidden />
                    <b>{r.label}</b>
                    <span className="where-names">{r.names.join(', ')}{r.count > 2 ? ` 외 ${r.count - 2}벌` : ''}</span>
                    <em>{r.count}벌</em>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>
    </div>
  )
}
