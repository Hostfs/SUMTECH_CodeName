import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
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
  const [selected, setSelected] = useState<number[]>([])
  // 옷 넣기 창: 고른 옷을 넣을 공간을 고르거나(garments), 고른 공간에 넣을 옷을 고른다(space).
  const [putting, setPutting] = useState<{ garments: GarmentSummary[] } | { space: SpaceView } | null>(null)

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
          <h2 className="section-title" style={{ margin: 0 }}>배치할 옷<small>{map.unplaced.length}벌 미배치{selected.length > 0 ? `, ${selected.length}벌 선택` : ''}</small></h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm" disabled={selected.length === 0 || leaves.length === 0 || busy !== null}
              onClick={() => setPutting({ garments: map.unplaced.filter((g) => selected.includes(g.id)) })}>
              선택한 옷 넣기
            </button>
            <button type="button" className="btn btn-sm btn-outline" onClick={recommend} disabled={busy === 'recommend' || map.spaces.length === 0 || map.unplaced.length === 0}>
              {busy === 'recommend' && <Spinner />}배치 추천 받기
            </button>
          </div>
        </div>
        {map.spaces.length === 0 && <div className="empty"><p>먼저 ‘공간 추가’로 옷을 넣을 곳을 만들어 주세요. 예: 옷장 A 안의 왼쪽 행거.</p></div>}
        {map.spaces.length > 0 && map.unplaced.length > 0 && (
          <details className="field-hint" style={{ marginBottom: 12 }}>
            <summary style={{ cursor: 'pointer' }}>배치 추천은 어떤 기준인가요?</summary>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>옷을 골라 두면 고른 옷만, 고르지 않으면 미배치 옷 전체를 추천해요.</li>
              <li>이번 계절에 입지 않는 옷 → 장기보관 공간</li>
              <li>아우터·원피스·셔츠처럼 형태 유지가 필요한 옷 → 걸기 공간, 나머지 → 접기 공간</li>
              <li>같은 유형 중에서는 남은 자리가 많은 공간, 자주 입는 옷부터 자리를 잡아요.</li>
              <li>추천은 확정이 아니에요. 공간을 바꾸거나 빼고, 실제로 넣은 뒤 ‘배치 완료’를 눌러요.</li>
            </ul>
          </details>
        )}
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
        {map.unplaced.length > 0 && map.spaces.length > 0 && (
          <div style={{ marginTop: proposals.length > 0 ? 16 : 0 }}>
            <p className="field-hint" style={{ margin: '0 0 8px' }}>넣을 옷을 눌러 고른 뒤 ‘선택한 옷 넣기’로 공간을 정하거나, 공간 카드의 ‘옷 넣기’를 눌러요.</p>
            <div className="mini-list" role="group" aria-label="미배치 옷">
              {map.unplaced.map((g) => (
                <button key={g.id} type="button" className="mini mini-pick" aria-pressed={selected.includes(g.id)}
                  onClick={() => setSelected(selected.includes(g.id) ? selected.filter((x) => x !== g.id) : [...selected, g.id])}>
                  <span className="dot" style={{ background: g.colorHex ?? '#d9d3c9' }} />{g.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {map.unplaced.length === 0 && map.spaces.length > 0 && <p className="field-hint">모든 옷의 위치가 정해져 있어요.</p>}
      </section>

      <section className="section" aria-label="공간">
        <h2 className="section-title">공간<small>{map.spaces.length}곳</small></h2>
        <div className="spaces">
          {roots.flatMap((r) => [r, ...descendants(r, map.spaces)]).map((s) => (
            <SpaceCard key={s.id} s={s} isParent={!leaves.includes(s)} onPut={() => setPutting({ space: s })} />
          ))}
        </div>
      </section>

      {putting && (
        <PutSheet target={putting} leaves={leaves} busy={busy === 'put'} error={error}
          onClose={() => setPutting(null)} onPut={put} />
      )}

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

function SpaceCard({ s, isParent, onPut }: { s: SpaceView; isParent: boolean; onPut: () => void }) {
  const [qr, setQr] = useState(false)
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
      {!isParent && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-outline" onClick={onPut} aria-label={`${s.path}에 옷 넣기`}>
            <IconPlus />옷 넣기
          </button>
          {s.spaceType === 'BOX' && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setQr(true)} aria-label={`${s.path} QR 라벨`}>QR 라벨</button>
          )}
        </div>
      )}
      {qr && <QrLabelSheet s={s} onClose={() => setQr(false)} />}
    </article>
  )
}

/** 박스에 붙일 QR 라벨. 휴대폰 카메라로 찍으면 이 박스가 골라진 '옮기기' 화면이 열린다. */
function QrLabelSheet({ s, onClose }: { s: SpaceView; onClose: () => void }) {
  const [src, setSrc] = useState('')
  const url = `${window.location.origin}/move?to=${s.id}`
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 440, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => setSrc(''))
  }, [url])
  return (
    <Sheet title="QR 라벨" onClose={onClose}>
      <div className="qr-label">
        {src ? <img src={src} alt={`${s.path} 옮기기 QR`} /> : <Loading />}
        <strong>{s.path}</strong>
        <span style={{ fontSize: 12 }}>옷결 · 찍으면 이 박스로 옮기기</span>
      </div>
      <p className="field-hint">출력해서 박스에 붙여 두세요. 옷을 넣거나 꺼낼 때 휴대폰 카메라로 찍으면 바로 기록할 수 있어요.</p>
      <div className="sheet-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>닫기</button>
        <button type="button" className="btn" onClick={() => window.print()} disabled={!src}>인쇄</button>
      </div>
    </Sheet>
  )
}

/**
 * 옷 넣기. 고른 옷이 정해져 있으면 넣을 공간을 고르고, 공간이 정해져 있으면 넣을 옷을 고른다.
 * 누르는 즉시 위치가 확정되므로 실제로 옷을 넣은 뒤 누르도록 안내한다.
 */
function PutSheet({ target, leaves, busy, error, onClose, onPut }: {
  target: { garments: GarmentSummary[] } | { space: SpaceView }; leaves: SpaceView[]; busy: boolean; error: string
  onClose: () => void; onPut: (spaceId: number, garmentIds: number[]) => void
}) {
  const fixedSpace = 'space' in target ? target.space : null
  const [spaceId, setSpaceId] = useState<number | null>(fixedSpace?.id ?? null)
  const [picked, setPicked] = useState<number[]>('garments' in target ? target.garments.map((g) => g.id) : [])
  const [all, setAll] = useState<GarmentSummary[] | null>(null)
  useEffect(() => {
    if (fixedSpace) api.get<GarmentSummary[]>('/api/garments').then(setAll).catch(() => setAll([]))
  }, [fixedSpace])

  // 공간에 넣을 수 있는 옷: 세탁·수선 중이 아니고 이미 이 공간에 있지 않은 옷. 미배치 옷을 먼저 보여 준다.
  const choices = fixedSpace && all
    ? all.filter((g) => g.status !== 'WASHING' && g.status !== 'REPAIRING' && !(g.spaceId === fixedSpace.id && g.locationPath))
      .sort((a, b) => Number(Boolean(a.locationPath)) - Number(Boolean(b.locationPath)))
    : []
  const toggle = (id: number) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])

  return (
    <Sheet title={fixedSpace ? `${fixedSpace.path}에 옷 넣기` : `${picked.length}벌 넣을 공간 고르기`} onClose={onClose}>
      {fixedSpace ? (
        !all ? <Loading /> : choices.length === 0 ? <div className="empty"><p>넣을 수 있는 옷이 없어요.</p></div> : (
          <div className="form-grid" role="group" aria-label="넣을 옷">
            {choices.map((g) => (
              <button key={g.id} type="button" className="cand" style={{ gridTemplateColumns: 'auto 1fr' }} aria-pressed={picked.includes(g.id)} onClick={() => toggle(g.id)}>
                <span className="dot-lg" style={{ background: g.colorHex ?? '#d9d3c9' }} />
                <span><span className="cand-name">{g.name}</span><br /><span className="cand-meta">{g.locationPath ? `지금 ${g.locationPath}` : g.statusLabel === '보관 중' ? '미배치' : `미배치, ${g.statusLabel}`}</span></span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="form-grid" role="radiogroup" aria-label="넣을 공간">
          {leaves.map((s) => {
            const after = s.count + picked.length
            return (
              <button key={s.id} type="button" className="cand" style={{ gridTemplateColumns: '1fr' }} aria-pressed={spaceId === s.id} onClick={() => setSpaceId(s.id)}>
                <span><span className="cand-name">{s.path}</span><br />
                  <span className={`cand-meta${s.capacity && after > s.capacity ? ' danger' : ''}`}>
                    {s.spaceTypeLabel}{s.capacity ? `, 넣으면 ${after}/${s.capacity}벌${after > s.capacity ? ` (${after - s.capacity}벌 초과)` : ''}` : `, ${s.count}벌`}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
      <p className="field-hint">실제로 옷을 넣은 뒤 눌러 주세요. 누른 시점부터 이 위치로 보여요.</p>
      {error && <Notice>{error}</Notice>}
      <div className="sheet-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
        <button type="button" className="btn" disabled={!spaceId || picked.length === 0 || busy} onClick={() => spaceId && onPut(spaceId, picked)}>
          {busy && <Spinner />}{picked.length > 0 ? `${picked.length}벌 넣기` : '넣기'}
        </button>
      </div>
    </Sheet>
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
