import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { IconBox, IconChevron, IconMove, IconPinQuestion, IconWash } from '../components/Icons'
import { Loading, Notice } from '../components/Ui'
import WeatherCard from '../components/WeatherCard'
import { isGuest, useSession } from '../session'
import type { Board, GarmentSummary, MapView } from '../types'
import { isNight } from '../weatherPicks'

function today() {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date())
}

type Action = { to: string; icon: ReactNode; title: string; sub: string; count?: number; tone?: 'danger' }

/**
 * 로그인 후 첫 화면(디자인 초안 Home): 인사와 날짜, 날씨 하늘 위 오늘 날씨와 바로 꺼낼 옷,
 * 그리고 보관함으로 가는 바로 가기(옮기기·관리함·미배치·집 밖/박스). 숫자는 모두 서버 값이다.
 */
export default function Home() {
  const { me } = useSession()
  const [garments, setGarments] = useState<GarmentSummary[] | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  const [map, setMap] = useState<MapView | null>(null)
  const [error, setError] = useState('')
  const night = useMemo(() => isNight(), [])

  useEffect(() => {
    let alive = true
    api.get<GarmentSummary[]>('/api/garments').then((g) => alive && setGarments(g)).catch((e) => alive && setError(errorMessage(e)))
    api.get<Board>('/api/care').then((b) => alive && setBoard(b)).catch(() => undefined)
    api.get<MapView>('/api/spaces').then((m) => alive && setMap(m)).catch(() => undefined)
    return () => { alive = false }
  }, [])

  // 밤에는 홈 전체를 어두운 톤으로 둔다(초안과 같다). 홈을 떠나면 원래 밝은 톤으로 돌아간다.
  useEffect(() => {
    if (!night) return
    const root = document.documentElement
    root.dataset.tone = 'dark'
    return () => { delete root.dataset.tone }
  }, [night])

  const name = isGuest(me) ? '게스트' : (me?.email ?? '').split('@')[0]
  const late = board ? board.overdue.length + board.dueToday.length : 0
  const away = garments?.filter((g) => g.locationKind === 'BOX' || g.locationKind === 'OFFSITE').length ?? 0
  const actions: Action[] = [
    { to: '/move', icon: <IconMove />, title: '옮기기', sub: '박스·본가·세탁소로 묶어 보내요' },
    {
      to: '/care', icon: <IconWash />, title: '관리함',
      sub: board ? (late ? `기한 지남·오늘 회수 ${late}건` : `맡긴 옷 ${board.inProgress.length + late}벌`) : '맡긴 옷과 회수일',
      count: late || undefined, tone: late ? 'danger' : undefined,
    },
    { to: '/map', icon: <IconPinQuestion />, title: '미배치', sub: map ? (map.unplaced.length ? `자리 정할 옷 ${map.unplaced.length}벌` : '모두 제자리에 있어요') : '옷장 지도에서 자리 정하기', count: map?.unplaced.length || undefined },
    { to: '/closet?view=where', icon: <IconBox />, title: '집 밖·박스', sub: garments ? `박스·본가에 ${away}벌` : '어디 있는지 나눠 보기' },
  ]

  return (
    <div className="home">
      <header className="home-head">
        <p className="home-date">{today()}</p>
        <p className="home-hello">안녕하세요,</p>
        <h1 className="home-name">{name}<span>님</span></h1>
      </header>

      <div className="home-grid">
        <div className="home-main">
          <WeatherCard items={garments ?? []} />
          {garments && (garments.length === 0 ? <StartGuide /> : <WhereNow garments={garments} />)}
        </div>

        <aside className="home-side">
          {error && <Notice>{error}</Notice>}
          {!garments && !error && <Loading />}
          {garments && garments.length === 0 && (
            <div className="empty">
              <strong>등록된 옷이 0벌이에요</strong>
              <p>새로 산 옷이나 오늘 입은 옷부터 한 벌씩 등록해 보세요. 택을 찍으면 브랜드와 세탁법을 읽어 드려요.</p>
              <Link className="btn" to="/register">옷 등록</Link>
            </div>
          )}
          {garments && garments.length > 0 && (
            <Link to="/closet" className="home-closet">
              <span><small>내 옷장</small><b>{garments.length}벌</b></span>
              <span className="home-closet-go">전체 보기<IconChevron /></span>
            </Link>
          )}

          <section className="home-actions" aria-label="바로 가기">
            <h2 className="section-title">보관함 바로 가기</h2>
            <ul>
              {actions.map((a) => (
                <li key={a.title}>
                  <Link to={a.to} className={`home-action${a.tone ? ` ${a.tone}` : ''}`}>
                    <span className="home-action-ico">{a.icon}</span>
                    <span className="home-action-text"><b>{a.title}</b><small>{a.sub}</small></span>
                    {a.count ? <span className="home-action-count">{a.count}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

const KINDS: { kind: GarmentSummary['locationKind']; label: string }[] = [
  { kind: 'HOME', label: '집 안' },
  { kind: 'BOX', label: '박스 속' },
  { kind: 'OFFSITE', label: '집 밖' },
  { kind: 'CARE', label: '세탁·수선 맡김' },
  { kind: 'UNPLACED', label: '미배치' },
]

/** 지금 내 옷이 어디에 나뉘어 있는지. 박스·본가·세탁소에 있는 옷을 홈에서 바로 알 수 있게 한다. */
function WhereNow({ garments }: { garments: GarmentSummary[] }) {
  const rows = KINDS.map(({ kind, label }) => {
    const list = garments.filter((g) => g.locationKind === kind)
    return { kind, label, count: list.length, names: list.slice(0, 2).map((g) => g.name) }
  }).filter((r) => r.count > 0)
  return (
    <section className="home-panel" aria-label="지금 내 옷은 어디에">
      <div className="home-panel-head">
        <h2>지금 내 옷은 어디에</h2>
        <Link to="/closet?view=where">나눠 보기<IconChevron /></Link>
      </div>
      <div className="where-bar" aria-hidden>
        {rows.map((r) => <span key={r.kind} className={`where-${r.kind}`} style={{ flexGrow: r.count }} />)}
      </div>
      <ul className="where-list">
        {rows.map((r) => (
          <li key={r.kind}>
            <span className={`where-dot where-${r.kind}`} aria-hidden />
            <b>{r.label}</b>
            <span className="where-names">{r.names.join(', ')}{r.count > 2 ? ` 외 ${r.count - 2}벌` : ''}</span>
            <em>{r.count}벌</em>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 빈 옷장: 처음 쓰는 순서. */
function StartGuide() {
  return (
    <section className="home-panel" aria-label="이렇게 시작해요">
      <div className="home-panel-head"><h2>이렇게 시작해요</h2></div>
      <ol className="start-steps">
        <li><b>옷 등록</b><span>택 사진을 올리면 브랜드·소재·세탁법을 읽어 채워요.</span></li>
        <li><b><Link to="/map">옷장 지도</Link></b><span>옷장·서랍·박스·본가를 공간으로 만들어 둬요.</span></li>
        <li><b><Link to="/move">옮기기</Link></b><span>박스·본가·세탁소로 옮길 때 여러 벌을 한 번에 기록해요.</span></li>
      </ol>
    </section>
  )
}
