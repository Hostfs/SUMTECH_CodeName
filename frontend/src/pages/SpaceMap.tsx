import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import GarmentArt from '../components/GarmentArt'
import { IconPlus } from '../components/Icons'
import { Loading, Notice, Sheet, Spinner, Toast } from '../components/Ui'
import { useSession } from '../session'
import type { GarmentSummary, MapView, Proposal, SpaceView } from '../types'

/** 옷장 지도: 공간 등록 → 배치 추천(미확정) → 실제로 넣고 '배치 완료'. */
export default function SpaceMap() {
  const { meta } = useSession()
  const [map, setMap] = useState<MapView | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(() => {
    api.get<MapView>('/api/spaces').then(setMap).catch((e) => setError(errorMessage(e)))
    api.get<Proposal[]>('/api/placements').then(setProposals).catch(() => undefined)
  }, [])
  useEffect(load, [load])

  async function act<T>(key: string, fn: () => Promise<T>, done?: (r: T) => void) {
    setBusy(key)
    setError('')
    try {
      const r = await fn()
      done?.(r)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const recommend = () => act('recommend', () => api.post<Proposal[]>('/api/placements/recommend'), (r) => { setProposals(r); setToast(`${r.length}벌의 배치를 추천했어요`) })
  const apply = (p: Proposal) => act(`apply-${p.id}`, () => api.post<Proposal[]>(`/api/placements/${p.id}/apply`), (r) => { setProposals(r); load(); setToast(`${p.garment.name}을(를) 배치했어요`) })
  const dismiss = (p: Proposal) => act(`dismiss-${p.id}`, () => api.del<Proposal[]>(`/api/placements/${p.id}`), setProposals)
  const change = (p: Proposal, spaceId: number) => act(`change-${p.id}`, () => api.put<Proposal[]>(`/api/placements/${p.id}`, { spaceId }), setProposals)

  if (!map) return error ? <Notice>{error}</Notice> : <Loading />
  const leaves = map.spaces.filter((s) => !map.spaces.some((o) => o.parentId === s.id))
  const roots = map.spaces.filter((s) => s.parentId === null)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">옷장 지도</h1>
        <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}><IconPlus />공간 추가</button>
      </div>
      <p className="page-lead">옷장·서랍·박스를 등록하고 옷을 넣어 두면, 내 옷장에서 검색할 때 꺼낼 위치가 보여요.</p>
      {error && <div style={{ marginBottom: 16 }}><Notice>{error}</Notice></div>}

      <section className="section" aria-label="배치">
        <div className="page-head" style={{ margin: '0 0 12px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>배치할 옷<small>{map.unplaced.length}벌 미배치</small></h2>
          <button type="button" className="btn btn-sm btn-outline" onClick={recommend} disabled={busy === 'recommend' || map.spaces.length === 0 || map.unplaced.length === 0}>
            {busy === 'recommend' && <Spinner />}배치 추천 받기
          </button>
        </div>
        {map.spaces.length === 0 && <div className="empty"><p>먼저 ‘공간 추가’로 옷을 넣을 곳을 만들어 주세요. 예: 옷장 A 안의 왼쪽 행거.</p></div>}
        {proposals.length > 0 && (
          <>
            <Notice kind="info">추천은 아직 확정되지 않았어요. 실제로 옷을 넣은 뒤 ‘배치 완료’를 눌러야 위치가 바뀌어요.</Notice>
            <div style={{ marginTop: 12 }}>
              {proposals.map((p) => (
                <div className="row-item" key={p.id} aria-label={`${p.garment.name} 배치 추천`}>
                  <Thumb g={p.garment} />
                  <div className="row-main">
                    <span className="row-title">{p.garment.name}</span>
                    <div className="row-sub">
                      <select aria-label={`${p.garment.name} 추천 공간`} className="inline-select" style={{ border: 0, background: 'none', padding: 0, fontWeight: 700, color: 'var(--accent)' }}
                        value={p.spaceId} onChange={(e) => change(p, Number(e.target.value))}>
                        {leaves.map((s) => <option key={s.id} value={s.id}>{s.path}</option>)}
                      </select>
                    </div>
                    <div className="row-sub">{p.reason}</div>
                    {p.overBy > 0 && <div className="row-sub danger">이 공간이 {p.overBy}벌 넘쳐요({p.projectedCount}/{p.capacity}). 다른 공간을 골라 주세요.</div>}
                  </div>
                  <div className="row-actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => dismiss(p)} disabled={busy !== null}>빼기</button>
                    <button type="button" className="btn btn-sm" onClick={() => apply(p)} disabled={busy !== null}>{busy === `apply-${p.id}` && <Spinner />}배치 완료</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {proposals.length === 0 && map.unplaced.length > 0 && map.spaces.length > 0 && (
          <div className="mini-list">
            {map.unplaced.map((g) => <Mini key={g.id} g={g} />)}
          </div>
        )}
        {map.unplaced.length === 0 && map.spaces.length > 0 && <p className="field-hint">모든 옷의 위치가 정해져 있어요.</p>}
      </section>

      <section className="section" aria-label="공간">
        <h2 className="section-title">공간<small>{map.spaces.length}곳</small></h2>
        <div className="spaces">
          {roots.flatMap((r) => [r, ...descendants(r, map.spaces)]).map((s) => <SpaceCard key={s.id} s={s} isParent={!leaves.includes(s)} />)}
        </div>
      </section>

      {adding && (
        <AddSpaceSheet spaces={map.spaces} spaceTypes={meta?.spaceTypes ?? []} onClose={() => setAdding(false)}
          onSaved={(next) => { setMap(next); setAdding(false); setToast('공간을 추가했어요') }} />
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </>
  )
}

function descendants(s: SpaceView, all: SpaceView[]): SpaceView[] {
  return all.filter((x) => x.parentId === s.id).flatMap((c) => [c, ...descendants(c, all)])
}

function Thumb({ g }: { g: GarmentSummary }) {
  return <div className="row-thumb">{g.imageUrl ? <img src={g.imageUrl} alt="" /> : <GarmentArt subType={g.subType} colorHex={g.colorHex} title={g.name} />}</div>
}

function Mini({ g }: { g: GarmentSummary }) {
  return <Link className="mini" to={`/closet/${g.id}`}><span className="dot" style={{ background: g.colorHex ?? '#d9d3c9' }} />{g.name}</Link>
}

function SpaceCard({ s, isParent }: { s: SpaceView; isParent: boolean }) {
  const over = s.overBy > 0
  const pct = s.capacity ? Math.min(100, (s.count / s.capacity) * 100) : 0
  return (
    <article className="space-card" aria-label={s.path}>
      <div className="space-head">
        <span className="space-name">{s.path}</span>
        <span className={`space-meta${over ? ' over' : ''}`}>
          {s.spaceTypeLabel}{s.capacity ? `, ${s.count}/${s.capacity}벌` : isParent ? '' : `, ${s.count}벌`}{over ? `, ${s.overBy}벌 초과` : ''}
        </span>
      </div>
      {s.capacity ? <div className={`meter${over ? ' over' : ''}`}><span style={{ width: `${pct}%` }} /></div> : <div style={{ height: 10 }} />}
      {isParent ? <p className="field-hint" style={{ margin: 0 }}>안쪽 공간에 옷을 넣어요</p>
        : s.garments.length > 0 ? <div className="mini-list">{s.garments.map((g) => <Mini key={g.id} g={g} />)}</div>
          : <p className="field-hint" style={{ margin: 0 }}>비어 있어요</p>}
    </article>
  )
}

function AddSpaceSheet({ spaces, spaceTypes, onClose, onSaved }: {
  spaces: SpaceView[]; spaceTypes: { value: string; label: string }[]; onClose: () => void; onSaved: (m: MapView) => void
}) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [spaceType, setSpaceType] = useState('HANG')
  const [capacity, setCapacity] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onSaved(await api.post<MapView>('/api/spaces', {
        name, parentId: parentId ? Number(parentId) : null, spaceType, capacity: capacity ? Number(capacity) : null,
      }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="공간 추가" onClose={onClose}>
      <form className="form-grid" onSubmit={save} noValidate>
        <div className="field">
          <label htmlFor="sp-name">공간 이름</label>
          <input id="sp-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 왼쪽 행거, 2단, 겨울 박스" maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="sp-parent">어디 안에 있나요</label>
          <select id="sp-parent" className="select" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">따로 있는 공간(최상위)</option>
            {spaces.map((s) => <option key={s.id} value={s.id}>{s.path}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field-label" id="sp-type">유형</span>
          <div className="chips wrap" role="group" aria-labelledby="sp-type" style={{ marginTop: 0 }}>
            {spaceTypes.map((t) => <button key={t.value} type="button" className="chip" aria-pressed={spaceType === t.value} onClick={() => setSpaceType(t.value)}>{t.label}</button>)}
          </div>
        </div>
        <div className="field">
          <label htmlFor="sp-cap">수용 개수</label>
          <input id="sp-cap" className="input" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))} placeholder="대략 몇 벌 들어가나요" />
          <span className="field-hint">정확한 치수 대신 대략적인 벌 수예요. 넘치면 추천에서 알려 줘요.</span>
        </div>
        {error && <Notice>{error}</Notice>}
        <div className="sheet-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
          <button type="submit" className="btn" disabled={busy}>{busy && <Spinner />}저장</button>
        </div>
      </form>
    </Sheet>
  )
}
