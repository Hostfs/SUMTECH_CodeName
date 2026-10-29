import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { Icon } from '../components/Icon'
import StorageTabs, { GarmentPick, GarmentThumb, PlaceRadios, SpaceIcon, Thumbs } from '../components/StorageTabs'
import { Loading, Notice, Sheet, Spinner, Toast } from '../components/Ui'
import { useSession } from '../session'
import type { GarmentSummary, MapView, Proposal, SpaceView } from '../types'
import '../styles/storage.app.css'

/**
 * 옷장 지도(디자인 초안 보관함의 '옷장 지도'): 공간 등록 → 배치 추천(미확정) → 실제로 넣고 '배치 완료'.
 * 초안 그대로 요약(.overview) · 위치가 없는 옷(.callout) · 공간 카드(.space)를 두고, 우리 기능(옷 고르기·옷 넣기·추천 공간 바꾸기)을 같은 부품으로 잇는다.
 */
export default function SpaceMap() {
  const { meta } = useSession()
  const [map, setMap] = useState<MapView | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  // 옷 넣기 창: 고른 옷을 넣을 공간을 고르거나(garments), 고른 공간에 넣을 옷을 고른다(space).
  const [putting, setPutting] = useState<{ garments: GarmentSummary[] } | { space: SpaceView } | null>(null)

  const load = useCallback(() => {
    api.get<MapView>('/api/spaces').then(setMap).catch((e) => setError(errorMessage(e)))
    api.get<Proposal[]>('/api/placements').then(setProposals).catch(() => undefined)
  }, [])
  useEffect(load, [load])
  const closePut = useCallback(() => setPutting(null), [])
  const closeAdd = useCallback(() => setAdding(false), [])
  const clearToast = useCallback(() => setToast(''), [])

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

  const recommend = () => act('recommend', () => api.post<Proposal[]>('/api/placements/recommend', { garmentIds: selected }),
    (r) => { setProposals(r); setSelected([]); setToast(`${r.length}벌의 배치를 추천했어요`) })
  const put = (spaceId: number, garmentIds: number[]) => act('put', () => api.post<MapView>(`/api/spaces/${spaceId}/garments`, { garmentIds }),
    (m) => {
      setMap(m)
      setPutting(null)
      setSelected([])
      api.get<Proposal[]>('/api/placements').then(setProposals).catch(() => undefined)
      setToast(`${garmentIds.length}벌을 넣었어요`)
    })
  const apply = (p: Proposal) => act(`apply-${p.id}`, () => api.post<Proposal[]>(`/api/placements/${p.id}/apply`), (r) => { setProposals(r); load(); setToast(`${p.garment.name}을(를) 배치했어요`) })
  const dismiss = (p: Proposal) => act(`dismiss-${p.id}`, () => api.del<Proposal[]>(`/api/placements/${p.id}`), setProposals)
  const change = (p: Proposal, spaceId: number) => act(`change-${p.id}`, () => api.put<Proposal[]>(`/api/placements/${p.id}`, { spaceId }), setProposals)

  if (!map) {
    return (
      <div className="page pinned storage">
        <StorageTabs />
        {error ? <Notice>{error}</Notice> : <Loading />}
      </div>
    )
  }
  const leaves = map.spaces.filter((s) => !map.spaces.some((o) => o.parentId === s.id))
  const roots = map.spaces.filter((s) => s.parentId === null)
  // 제자리 비율: 공간에 넣어 둔 옷 / (넣어 둔 옷 + 미배치 옷). 세탁·수선 중인 옷은 세지 않는다.
  const placed = leaves.reduce((n, s) => n + s.count, 0)
  const atHome = placed + map.unplaced.length
  const pct = atHome ? Math.round((placed / atHome) * 100) : 0
  const pick = (id: number) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div className="page pinned storage">
      <StorageTabs action={<button type="button" className="link-btn" onClick={() => setAdding(true)}>공간 추가</button>} />
      {error && <Notice>{error}</Notice>}

      <div className="st-map-top">
        <section className="overview" aria-label="배치 요약">
          <div className="ring" style={{ '--p': `${pct}%` } as CSSProperties} role="img" aria-label={`제자리 ${pct}%`}><b>{pct}<small>%</small></b></div>
          <div>
            <p className="ov-title">{atHome}벌 중 {placed}벌이<br />제자리에 있어요</p>
            <p className="ov-sub">공간 {map.spaces.length}곳 · 미배치 {map.unplaced.length}벌</p>
          </div>
        </section>

        {map.unplaced.length > 0 && (
          <section className="callout" aria-label="배치">
            <div className="callout-top">
              <Thumbs items={map.unplaced} max={4} />
              <p>
                <b>위치가 없는 옷 {map.unplaced.length}벌</b>
                {/* 공간이 있으면 아래 칩으로 옷을 고른다. 고르면 고른 옷만 추천하거나 바로 넣는다. */}
                <small>{map.spaces.length === 0 ? map.unplaced.map((g) => g.name).join(', ')
                  : selected.length > 0 ? `${selected.length}벌 골랐어요 · 고른 옷만 추천하거나 바로 넣어요` : '옷을 눌러 고르면 고른 옷만 추천해요'}</small>
              </p>
            </div>
            {map.spaces.length === 0 ? (
              <p className="hint">먼저 ‘공간 추가’로 옷을 넣을 곳을 만들어 주세요. 예: 옷장 A 안의 왼쪽 행거.</p>
            ) : (
              <div className="chips st-pick-chips" role="group" aria-label="미배치 옷">
                {map.unplaced.map((g) => {
                  const on = selected.includes(g.id)
                  return <button key={g.id} type="button" className="chip" data-on={on} aria-pressed={on} onClick={() => pick(g.id)}>{g.name}</button>
                })}
              </div>
            )}
            <div className="st-callout-actions">
              <button type="button" className="btn btn-primary btn-block" onClick={recommend} disabled={busy === 'recommend' || map.spaces.length === 0}>
                {busy === 'recommend' ? <Spinner /> : <Icon name="sparkle" size={14} />} 배치 추천 받기
              </button>
              {/* 고른 옷이 있을 때만: 추천 없이 고른 옷을 바로 넣을 공간을 고른다. */}
              {selected.length > 0 && (
                <button type="button" className="btn btn-ghost btn-block" disabled={leaves.length === 0 || busy !== null}
                  onClick={() => setPutting({ garments: map.unplaced.filter((g) => selected.includes(g.id)) })}>
                  선택한 옷 넣기 ({selected.length}벌)
                </button>
              )}
            </div>
            {map.spaces.length > 0 && (
              <details className="st-criteria">
                <summary>배치 추천은 어떤 기준인가요?</summary>
                <ul>
                  <li>옷을 골라 두면 고른 옷만, 고르지 않으면 미배치 옷 전체를 추천해요.</li>
                  <li>이번 계절에 입지 않는 옷 → 장기보관 공간</li>
                  <li>아우터·원피스·셔츠처럼 형태 유지가 필요한 옷 → 걸기 공간, 나머지 → 접기 공간</li>
                  <li>같은 유형 중에서는 남은 자리가 많은 공간, 자주 입는 옷부터 자리를 잡아요.</li>
                  <li>추천은 확정이 아니에요. 공간을 바꾸거나 빼고, 실제로 넣은 뒤 ‘배치 완료’를 눌러요.</li>
                </ul>
              </details>
            )}
          </section>
        )}
      </div>

      {/* 배치 추천(초안의 배치 추천 시트 내용). 서버에 남는 미확정 추천이라 화면에 두고, '배치 완료'를 눌러야 위치가 바뀐다. */}
      {proposals.length > 0 && (
        <section className="space st-plan" aria-label="배치 추천">
          <header className="space-head">
            <span className="space-ico"><Icon name="sparkle" size={17} /></span>
            <div className="space-title">
              <h3>배치 추천</h3>
              <small>{proposals.length}벌 · 아직 확정 전이에요</small>
            </div>
          </header>
          <p className="hint">추천은 아직 확정되지 않았어요. 실제로 옷을 넣은 뒤 ‘배치 완료’를 눌러야 위치가 바뀌어요.</p>
          <ul className="plan">
            {proposals.map((p) => (
              <li key={p.id} className={p.overBy > 0 ? 'over' : undefined} aria-label={`${p.garment.name} 배치 추천`}>
                <span className="st-plan-art"><GarmentThumb g={p.garment} /></span>
                <span className="plan-main">
                  <b>{p.garment.name}</b>
                  <label className="st-plan-to">
                    <span aria-hidden="true">→</span>
                    <select aria-label={`${p.garment.name} 추천 공간`} value={p.spaceId} onChange={(e) => change(p, Number(e.target.value))}>
                      {leaves.map((s) => <option key={s.id} value={s.id}>{s.path}</option>)}
                    </select>
                    <Icon name="chevronDown" size={13} stroke={2.2} />
                  </label>
                  <small>{p.reason}{p.capacity ? ` · ${p.projectedCount}/${p.capacity}벌` : ''}</small>
                  {p.overBy > 0 && <small className="st-plan-over">이 공간이 {p.overBy}벌 넘쳐요({p.projectedCount}/{p.capacity}). 다른 공간을 골라 주세요.</small>}
                </span>
                <span className="st-plan-actions">
                  <button type="button" className="btn btn-sm" onClick={() => apply(p)} disabled={busy !== null}>{busy === `apply-${p.id}` && <Spinner />}배치 완료</button>
                  <button type="button" className="btn-text" onClick={() => dismiss(p)} disabled={busy !== null}>빼기</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {map.spaces.length === 0 ? (
        <div className="empty st-empty-map">
          <p className="empty-title">아직 등록한 공간이 없어요</p>
          <p>옷장·서랍·박스를 등록하고 옷을 넣어 두면, 내 옷장에서 검색할 때 꺼낼 위치가 보여요.</p>
          <p>위의 ‘공간 추가’로 옷을 넣을 곳을 만들어 주세요. 예: 옷장 A 안의 왼쪽 행거.</p>
        </div>
      ) : (
        <div className="space-list st-spaces">
          {roots.map((r) => (
            <SpaceCard key={r.id} root={r} slots={[r, ...descendants(r, map.spaces)].filter((s) => leaves.includes(s))}
              onPut={(s) => setPutting({ space: s })} />
          ))}
        </div>
      )}

      {putting && (
        <PutSheet target={putting} all={map.spaces} leaves={leaves} busy={busy === 'put'} error={error}
          onClose={closePut} onPut={put} />
      )}

      {adding && (
        <AddSpaceSheet spaces={map.spaces} spaceTypes={meta?.spaceTypes ?? []} onClose={closeAdd}
          onSaved={(next) => { setMap(next); setAdding(false); setToast('공간을 추가했어요') }} />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}

function descendants(s: SpaceView, all: SpaceView[]): SpaceView[] {
  return all.filter((x) => x.parentId === s.id).flatMap((c) => [c, ...descendants(c, all)])
}

/**
 * 최상위 공간 하나(초안 SpaceCard): 머리 · 수용 막대 · 칸 줄. 안쪽 공간은 칸 한 줄씩(이름·옷 동그라미·벌 수),
 * 줄을 누르면 넣어 둔 옷이 펼쳐지고, 오른쪽 +로 그 칸에 옷을 넣는다.
 */
function SpaceCard({ root, slots, onPut }: { root: SpaceView; slots: SpaceView[]; onPut: (s: SpaceView) => void }) {
  const single = slots.length === 1 && slots[0].id === root.id
  const count = slots.reduce((n, s) => n + s.count, 0)
  const capacity = slots.reduce((n, s) => n + (s.capacity ?? 0), 0)
  const over = slots.some((s) => s.overBy > 0)
  const full = capacity > 0 && count >= capacity
  const pct = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : 0
  return (
    <article className="space" aria-label={root.path}>
      <header className="space-head">
        <span className="space-ico"><SpaceIcon type={root.spaceType} /></span>
        <div className="space-title">
          <h3>{root.name}</h3>
          <small>{single ? root.spaceTypeLabel : `${root.spaceTypeLabel} · 안쪽 ${slots.length}곳`}</small>
        </div>
        {!capacity && <span className={`st-space-count${over ? ' st-over' : ''}`}>{count}벌</span>}
      </header>
      {capacity > 0 && (
        <div className="cap" aria-label={`${capacity}벌 중 ${count}벌`}>
          <div className="cap-bar"><i style={{ width: `${pct}%` }} data-full={full || over} /></div>
          <span data-full={full} className={over ? 'st-over' : undefined}>{over ? `${count}/${capacity}벌 · 넘침` : full ? '가득 찼어요' : `${count}/${capacity}벌`}</span>
        </div>
      )}
      {slots.length === 0 ? (
        <p className="hint">안쪽 공간을 추가하면 옷을 넣을 수 있어요</p>
      ) : (
        <ul className="slots">
          {slots.map((s) => (
            <Slot key={s.id} s={s} name={single ? null : s.path.slice(root.path.length).replace(/^\s*→\s*/, '')} onPut={() => onPut(s)} />
          ))}
        </ul>
      )}
    </article>
  )
}

function Slot({ s, name, onPut }: { s: SpaceView; name: string | null; onPut: () => void }) {
  const [open, setOpen] = useState(false)
  const has = s.garments.length > 0
  const isOpen = open && has
  return (
    <li className="slot">
      <div className="st-slot-line">
        <button type="button" className="slot-row" aria-expanded={has ? isOpen : undefined} disabled={!has} onClick={() => setOpen(!open)}>
          <span className="slot-name">{name ?? '전체'}</span>
          <Thumbs items={s.garments} />
          <span className={`slot-count${s.overBy > 0 ? ' st-over' : ''}`}>{s.capacity ? `${s.count}/${s.capacity}` : s.count}<span className="sr-only">벌</span></span>
          <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={15} />
        </button>
        <button type="button" className="st-slot-add" onClick={onPut} aria-label={`${s.path}에 옷 넣기`}><Icon name="plus" size={17} stroke={2.2} /></button>
      </div>
      {isOpen && (
        <ul className="slot-list">
          {s.garments.map((g) => (
            <li key={g.id}>
              <Link to={`/closet/${g.id}`} className="slot-item">
                <GarmentThumb g={g} />
                <b>{g.name}</b>
                <small>{g.categoryLabel}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * 옷 넣기. 고른 옷이 정해져 있으면 넣을 공간을 고르고(초안 LocationSheet), 공간이 정해져 있으면 넣을 옷을 고른다.
 * 누르는 즉시 위치가 확정되므로 실제로 옷을 넣은 뒤 누르도록 안내한다.
 */
function PutSheet({ target, all, leaves, busy, error, onClose, onPut }: {
  target: { garments: GarmentSummary[] } | { space: SpaceView }; all: SpaceView[]; leaves: SpaceView[]; busy: boolean; error: string
  onClose: () => void; onPut: (spaceId: number, garmentIds: number[]) => void
}) {
  const fixedSpace = 'space' in target ? target.space : null
  const [spaceId, setSpaceId] = useState<number | null>(fixedSpace?.id ?? null)
  const [picked, setPicked] = useState<number[]>('garments' in target ? target.garments.map((g) => g.id) : [])
  const [garments, setGarments] = useState<GarmentSummary[] | null>(null)
  useEffect(() => {
    if (fixedSpace) api.get<GarmentSummary[]>('/api/garments').then(setGarments).catch(() => setGarments([]))
  }, [fixedSpace])

  // 공간에 넣을 수 있는 옷: 세탁·수선 중이 아니고 이미 이 공간에 있지 않은 옷. 미배치 옷을 먼저 보여 준다.
  const choices = fixedSpace && garments
    ? garments.filter((g) => g.status !== 'WASHING' && g.status !== 'REPAIRING' && !(g.spaceId === fixedSpace.id && g.locationPath))
      .sort((a, b) => Number(Boolean(a.locationPath)) - Number(Boolean(b.locationPath)))
    : []
  const toggle = (id: number) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])
  const after = (s: SpaceView) => s.count + picked.length

  return (
    <Sheet title={fixedSpace ? `${fixedSpace.path}에 옷 넣기` : `${picked.length}벌 넣을 공간 고르기`} onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary btn-block" disabled={!spaceId || picked.length === 0 || busy} onClick={() => spaceId && onPut(spaceId, picked)}>
          {busy && <Spinner />}{picked.length > 0 ? `${picked.length}벌 넣기` : '넣기'}
        </button>
      }>
      <p className="hint">실제로 옷을 넣은 뒤 눌러 주세요. 누른 시점부터 이 위치로 보여요.</p>
      {fixedSpace ? (
        !garments ? <Loading /> : choices.length === 0 ? <div className="empty"><p>넣을 수 있는 옷이 없어요.</p></div> : (
          <div className="st-picks" role="group" aria-label="넣을 옷">
            {choices.map((g) => (
              <GarmentPick key={g.id} g={g} on={picked.includes(g.id)} onToggle={() => toggle(g.id)}
                sub={g.locationPath ? `지금 ${g.locationPath}` : g.statusLabel === '보관 중' ? '미배치' : `미배치, ${g.statusLabel}`} />
            ))}
          </div>
        )
      ) : (
        <PlaceRadios all={all} options={leaves} checked={spaceId} onPick={(s) => setSpaceId(s.id)} label="넣을 공간"
          note={(s) => (s.capacity
            ? `넣으면 ${after(s)}/${s.capacity}벌${after(s) > s.capacity ? ` (${after(s) - s.capacity}벌 초과)` : ''}`
            : `${s.spaceTypeLabel} · ${s.count}벌`)}
          danger={(s) => !!s.capacity && after(s) > s.capacity} />
      )}
      {error && <Notice>{error}</Notice>}
    </Sheet>
  )
}

/** 공간 추가(초안 '공간 추가' 시트): 이름 · 어디 안에 있는지 · 유형 · 수용 개수. */
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
    <Sheet title="공간 추가" onClose={onClose}
      footer={<button type="submit" form="st-add-space" className="btn btn-primary btn-block" disabled={busy}>{busy && <Spinner />}저장</button>}>
      <form id="st-add-space" className="fields" onSubmit={save} noValidate>
        <label className="field"><span>공간 이름 <i>*</i></span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 왼쪽 행거, 2단, 겨울 박스" maxLength={100} aria-invalid={!!error && !name.trim()} />
        </label>
        <label className="field"><span>어디 안에 있나요</span>
          <span className="st-select">
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">따로 있는 공간(최상위)</option>
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.path}</option>)}
            </select>
            <Icon name="chevronDown" size={16} />
          </span>
        </label>
        <div className="field">
          <span id="st-space-type">유형</span>
          <div className="chips" role="group" aria-labelledby="st-space-type">
            {spaceTypes.map((t) => (
              <button key={t.value} type="button" className="chip" data-on={spaceType === t.value} aria-pressed={spaceType === t.value} onClick={() => setSpaceType(t.value)}>{t.label}</button>
            ))}
          </div>
        </div>
        <label className="field"><span>수용 개수 (벌)</span>
          <input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))} placeholder="대략 몇 벌 들어가나요" />
          <small className="st-field-hint">정확한 치수 대신 대략적인 벌 수예요. 넘치면 추천에서 알려 줘요.</small>
        </label>
        {error && <Notice>{error}</Notice>}
      </form>
    </Sheet>
  )
}
