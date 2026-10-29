import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import GarmentCard from '../components/GarmentCard'
import TakeOutSheet from '../components/TakeOutSheet'
import { Icon } from '../components/Icon'
import { Loading, Notice } from '../components/Ui'
import { useLabel, useSession } from '../session'
import type { GarmentSummary } from '../types'
import '../styles/closet.app.css'

const VIEWS = [
  { value: 'category', label: '종류' },
  { value: 'season', label: '계절' },
  { value: 'brand', label: '브랜드' },
  { value: 'location', label: '위치' },
  { value: 'where', label: '집 밖/박스' },
  { value: 'status', label: '상태' },
  { value: 'collection', label: '컬렉션' },
] as const
type View = (typeof VIEWS)[number]['value']

type Group = { key: string; title: string; items: GarmentSummary[] }

/** 내 옷장(디자인 초안 Closet). 제목·검색·종류·보기 기준은 위에 고정되고 아래 카드 목록만 스크롤된다. */
export default function Closet() {
  const { meta } = useSession()
  const label = useLabel()
  const [params, setParams] = useSearchParams()
  const view = (VIEWS.some((v) => v.value === params.get('view')) ? params.get('view') : 'category') as View
  const category = params.get('category') ?? 'ALL'
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [items, setItems] = useState<GarmentSummary[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState('')
  // 선택 모드: 카드를 눌러 여러 벌을 고르고 옮기기 화면으로 넘긴다.
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState<number[]>([])
  const navigate = useNavigate()
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const endSelect = () => { setSelecting(false); setSel([]) }
  // 꺼내기: 박스·집 밖에 있는 옷을 찾은 카드에서 바로 집 안 자리로 옮긴다. 옮긴 뒤 목록을 다시 읽는다.
  const [takeOut, setTakeOut] = useState<GarmentSummary | null>(null)
  const [reload, setReload] = useState(0)

  // 검색어는 잠시 멈춘 뒤 서버에 보낸다(이름·브랜드·색상·종류·위치 경로에서 찾음).
  useEffect(() => {
    const t = setTimeout(() => {
      const q = query.trim()
      api.get<GarmentSummary[]>(`/api/garments${q ? `?q=${encodeURIComponent(q)}` : ''}`)
        .then((list) => { setItems(list); setError(''); if (!q) setTotal(list.length) })
        .catch((e) => setError(errorMessage(e)))
    }, query ? 250 : 0)
    return () => clearTimeout(t)
  }, [query, reload])

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(
    () => (items ?? []).filter((g) => category === 'ALL' || g.category === category),
    [items, category],
  )

  const groups = useMemo<Group[]>(() => groupBy(filtered, view, label, meta?.seasons.map((s) => s.value) ?? []), [filtered, view, label, meta])

  return (
    <div className="page pinned closet">
      <div className="pin">
        <header className="page-head">
          <h1>내 옷장{total !== null && <small>총 {total}벌</small>}</h1>
          {total !== null && total > 0 && (
            <button type="button" className="link-btn" aria-pressed={selecting} onClick={() => (selecting ? endSelect() : setSelecting(true))}>
              {selecting ? '선택 끝' : '선택'}
            </button>
          )}
        </header>

        <div className="closet-tools">
          <label className="search">
            <Icon name="search" size={20} />
            <input type="search" placeholder="이름·색상·위치로 검색" aria-label="검색창" value={query}
              onChange={(e) => { setQuery(e.target.value); setParam('q', e.target.value || null) }} />
          </label>

          <div className="chips scroll" role="group" aria-label="종류로 거르기">
            <button type="button" className="chip" data-on={category === 'ALL'} aria-pressed={category === 'ALL'} onClick={() => setParam('category', null)}>전체</button>
            {meta?.categories.map((c) => (
              <button key={c.value} type="button" className="chip" data-on={category === c.value} aria-pressed={category === c.value}
                onClick={() => setParam('category', c.value)}>{c.label}</button>
            ))}
          </div>

          <div className="filter-row">
            <label className="filter-btn" htmlFor="closet-view"><Icon name="filter" size={18} />보기 기준</label>
            <span className="result-count">{items && total !== null && filtered.length !== total ? `${filtered.length}벌` : ''}</span>
            <label className="sort">
              <select id="closet-view" aria-label="보기 기준" value={view} onChange={(e) => setParam('view', e.target.value)}>
                {VIEWS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
              <Icon name="chevronDown" size={16} />
            </label>
          </div>
        </div>
      </div>

      {error && <Notice>{error}</Notice>}
      {!items && !error && <Loading />}

      {items && total === 0 && !query && (
        <div className="empty">
          <p className="empty-title">등록된 옷이 0벌이에요</p>
          <p>새로 산 옷이나 오늘 입은 옷부터 한 벌씩 등록해 보세요. 택을 찍으면 브랜드와 세탁법을 읽어 드려요.</p>
          <Link className="btn btn-primary" to="/register">옷 등록</Link>
        </div>
      )}

      {items && items.length === 0 && query && (
        <div className="empty">
          <p className="empty-title">‘{query}’와 맞는 옷이 없어요</p>
          <p>이름, 색상, 브랜드, 보관 위치로 찾을 수 있어요.</p>
        </div>
      )}

      {items && items.length > 0 && filtered.length === 0 && (
        <div className="empty">
          <p className="empty-title">조건에 맞는 옷이 없어요</p>
          <p>다른 종류를 골라 보세요.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setParam('category', null)}>조건 초기화</button>
        </div>
      )}

      {groups.map((g) => (
        <section className="group" key={g.key} aria-label={`${g.title} 묶음`}>
          <h2 className="group-title">{g.title} <small>{g.items.length}벌</small></h2>
          <div className="grid">
            {g.items.map((item) => selecting
              ? <GarmentCard key={`${g.key}-${item.id}`} g={item} selected={sel.includes(item.id)} onToggle={toggle} />
              : <GarmentCard key={`${g.key}-${item.id}`} g={item} onTakeOut={setTakeOut} />)}
          </div>
        </section>
      ))}

      {takeOut && (
        <TakeOutSheet garment={takeOut} onClose={() => setTakeOut(null)}
          onDone={() => { setTakeOut(null); setReload((n) => n + 1) }} />
      )}

      {selecting && (
        <div className="selbar" role="region" aria-label="선택한 옷">
          <b>{sel.length}벌 선택</b>
          <button type="button" className="link-btn muted" onClick={() => setSel([])} disabled={sel.length === 0}>선택 해제</button>
          <button type="button" className="btn btn-primary" disabled={sel.length === 0} onClick={() => navigate(`/move?ids=${sel.join(',')}`)}>옮기기로 보내기</button>
        </div>
      )}
    </div>
  )
}

function groupBy(items: GarmentSummary[], view: View, label: ReturnType<typeof useLabel>, seasonOrder: string[]): Group[] {
  const map = new Map<string, Group>()
  const add = (key: string, title: string, g: GarmentSummary) => {
    if (!map.has(key)) map.set(key, { key, title, items: [] })
    map.get(key)!.items.push(g)
  }
  for (const g of items) {
    switch (view) {
      case 'category': add(g.category, g.categoryLabel, g); break
      case 'season':
        if (g.seasons.length === 0) add('~none', '계절 미지정', g)
        g.seasons.forEach((s) => add(s, label('seasons', s), g))
        break
      case 'brand': add(g.brand ?? '~none', g.brand ?? '브랜드 미입력', g); break
      case 'location': add(g.locationPath ?? `~${g.status}`, g.locationPath ?? (g.status === 'STORED' || g.status === 'PENDING' || g.status === 'WASH_WAITING' ? '미배치' : g.statusLabel), g); break
      case 'where': add(g.locationKind, g.locationKindLabel, g); break
      case 'status': add(g.status, g.statusLabel, g); break
      case 'collection':
        if (g.collections.length === 0) add('~none', '컬렉션 없음', g)
        g.collections.forEach((c) => add(c, c, g))
        break
    }
  }
  const groups = [...map.values()]
  if (view === 'season') {
    groups.sort((a, b) => order(seasonOrder, a.key) - order(seasonOrder, b.key))
  } else if (view === 'where') {
    // 바로 꺼낼 수 없는 곳(박스·집 밖·세탁소)을 먼저 보여 준다.
    const kinds = ['BOX', 'OFFSITE', 'CARE', 'UNPLACED', 'HOME']
    groups.sort((a, b) => order(kinds, a.key) - order(kinds, b.key))
  } else {
    groups.sort((a, b) => (a.key.startsWith('~') ? 1 : 0) - (b.key.startsWith('~') ? 1 : 0) || a.title.localeCompare(b.title, 'ko'))
  }
  return groups
}

function order(list: string[], key: string): number {
  const i = list.indexOf(key)
  return i === -1 ? 99 : i
}
