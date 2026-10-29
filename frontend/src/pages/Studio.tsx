import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { GarmentTile } from '../components/GarmentCard'
import { IconSparkle } from '../components/Icons'
import Mannequin from '../components/Mannequin'
import { Loading, Notice, Sheet, Spinner, Toast } from '../components/Ui'
import { useSession } from '../session'
import type { Body, GarmentSummary, Outfit, Recommendation } from '../types'

const BODY_FIELDS: { key: keyof Body; label: string; hint: string }[] = [
  { key: 'heightCm', label: '키', hint: '100~230' },
  { key: 'shoulderCm', label: '어깨너비', hint: '25~70' },
  { key: 'chestCm', label: '가슴둘레', hint: '50~180' },
  { key: 'waistCm', label: '허리둘레', hint: '40~180' },
  { key: 'hipCm', label: '엉덩이둘레', hint: '50~180' },
  { key: 'inseamCm', label: '다리 안쪽 길이', hint: '40~110' },
]
const OCCASIONS = ['출근', '등교', '데이트', '운동', '여행', '일상']

const isTop = (g: GarmentSummary) => g.category === 'TOP' || g.category === 'OUTER'
const isBottom = (g: GarmentSummary) => g.category === 'BOTTOM'

/** 코디 스튜디오: 치수 입력 → 회색 3D 모형에 상하의 입혀 보기 → 코디 저장, 또는 AI 추천. */
export default function Studio() {
  const { meta } = useSession()
  const [tab, setTab] = useState<'pick' | 'ai'>('pick')
  const [garments, setGarments] = useState<GarmentSummary[] | null>(null)
  const [body, setBody] = useState<Body | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [topId, setTopId] = useState<number | null>(null)
  const [bottomId, setBottomId] = useState<number | null>(null)
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [error, setError] = useState('')
  const [bodyBusy, setBodyBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    api.get<GarmentSummary[]>('/api/garments').then(setGarments).catch((e) => setError(errorMessage(e)))
    api.get<Body>('/api/body').then((b) => {
      setBody(b)
      setDraft(Object.fromEntries(BODY_FIELDS.map((f) => [f.key, b[f.key] == null ? '' : String(b[f.key])])))
    }).catch((e) => setError(errorMessage(e)))
    api.get<Outfit[]>('/api/outfits').then(setOutfits).catch(() => undefined)
  }, [])

  const tops = useMemo(() => (garments ?? []).filter(isTop), [garments])
  const bottoms = useMemo(() => (garments ?? []).filter(isBottom), [garments])
  const top = tops.find((g) => g.id === topId) ?? null
  const bottom = bottoms.find((g) => g.id === bottomId) ?? null

  async function applyBody(e: FormEvent) {
    e.preventDefault()
    setBodyBusy(true)
    setError('')
    try {
      const payload = Object.fromEntries(BODY_FIELDS.map((f) => [f.key, draft[f.key] ? Number(draft[f.key]) : null]))
      setBody(await api.put<Body>('/api/body', payload))
      setToast('치수를 적용했어요')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBodyBusy(false)
    }
  }

  async function clearBody() {
    await api.del('/api/body').catch((e) => setError(errorMessage(e)))
    setBody({ heightCm: null, shoulderCm: null, chestCm: null, waistCm: null, hipCm: null, inseamCm: null })
    setDraft({})
    setToast('신체 치수를 지웠어요')
  }

  const wear = useCallback((t: GarmentSummary | null, b: GarmentSummary | null) => {
    setTopId(t?.id ?? null)
    setBottomId(b?.id ?? null)
    setTab('pick')
  }, [])

  if (!garments || !body) return error ? <Notice>{error}</Notice> : <Loading />

  const labels = [
    top ? (top.templateLabel ?? `${top.subTypeLabel}(3D 미지원)`) : null,
    bottom ? (bottom.templateLabel ?? `${bottom.subTypeLabel}(3D 미지원)`) : null,
    body.heightCm ? `키 ${Number(body.heightCm)}cm` : '키 기본 비율',
  ].filter(Boolean) as string[]
  const unknown = BODY_FIELDS.filter((f) => body[f.key] == null).map((f) => f.label)

  return (
    <>
      <div className="page-head"><h1 className="page-title">코디 스튜디오</h1></div>
      {error && <div style={{ marginBottom: 16 }}><Notice>{error}</Notice></div>}

      <div className="studio">
        <div className="studio-stage-wrap">
          <div className="stage">
            <Mannequin body={body} top={top} bottom={bottom} />
            <div className="stage-labels" aria-label="모형에 입힌 옷">{labels.map((l) => <span key={l}>{l}</span>)}</div>
          </div>
          <p className="stage-note">체형 비율과 코디 조화 참고용입니다. 실제 착용감과 핏은 다를 수 있습니다. 드래그해서 돌리고, 두 손가락이나 휠로 확대해요.</p>
          {unknown.length > 0 && <p className="stage-note">기본 비율로 그린 부위: {unknown.join(', ')}</p>}
        </div>

        <div>
          <div className="tabs" role="tablist" aria-label="코디 방식">
            <button type="button" role="tab" aria-selected={tab === 'pick'} onClick={() => setTab('pick')}>직접 고르기</button>
            <button type="button" role="tab" aria-selected={tab === 'ai'} onClick={() => setTab('ai')}>AI 추천</button>
          </div>

          {tab === 'pick' ? (
            <>
              <form className="card" onSubmit={applyBody} aria-label="신체 치수">
                <h2 className="section-title">신체 치수 <small>cm, 아는 값만</small></h2>
                <div className="body-grid">
                  {BODY_FIELDS.map((f) => (
                    <div className="field" key={f.key}>
                      <label htmlFor={`b-${f.key}`}>{f.label}</label>
                      <input id={`b-${f.key}`} className="input" inputMode="decimal" placeholder={f.hint} value={draft[f.key] ?? ''}
                        onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value.replace(/[^\d.]/g, '') })} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <button type="submit" className="btn btn-sm" disabled={bodyBusy}>{bodyBusy && <Spinner />}치수 적용</button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={clearBody}>치수 지우기</button>
                </div>
              </form>

              <Picker title="상의 목록" items={tops} selected={topId} onPick={setTopId} />
              <Picker title="하의 목록" items={bottoms} selected={bottomId} onPick={setBottomId} />

              <div style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-block" disabled={!top || !bottom} onClick={() => setSaving(true)}>코디 저장</button>
                {(!top || !bottom) && <p className="field-hint">상의와 하의를 하나씩 고르면 저장할 수 있어요.</p>}
              </div>

              <section className="section" aria-label="저장한 코디">
                <h2 className="section-title">저장한 코디<small>{outfits.length}개</small></h2>
                {outfits.length === 0 && <p className="field-hint">아직 저장한 코디가 없어요.</p>}
                {outfits.map((o) => (
                  <div className="row-item" key={o.id} aria-label={o.name}>
                    <div className="row-thumb">{o.top && <GarmentTile g={o.top} />}</div>
                    <div className="row-main">
                      <span className="row-title">{o.name}</span>
                      <div className="row-sub">{[o.top?.name, o.bottom?.name].filter(Boolean).join(', ')}</div>
                    </div>
                    <div className="row-actions">
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => wear(o.top, o.bottom)}>입혀 보기</button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={async () => setOutfits(await api.del<Outfit[]>(`/api/outfits/${o.id}`))}>삭제</button>
                    </div>
                  </div>
                ))}
              </section>
            </>
          ) : (
            <AiPanel garments={garments} seasons={meta?.seasons ?? []} currentSeason={meta?.currentSeason ?? ''} onWear={wear} />
          )}
        </div>
      </div>

      {saving && top && bottom && (
        <SaveSheet onClose={() => setSaving(false)} onSave={async (name) => {
          const next = await api.post<Outfit[]>('/api/outfits', { name, topId: top.id, bottomId: bottom.id })
          setOutfits(next)
          setSaving(false)
          setToast('코디를 저장했어요')
        }} />
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </>
  )
}

function Picker({ title, items, selected, onPick }: { title: string; items: GarmentSummary[]; selected: number | null; onPick: (id: number | null) => void }) {
  return (
    <section className="section" aria-label={title}>
      <h2 className="section-title">{title}<small>{items.length}벌</small></h2>
      {items.length === 0 ? <p className="field-hint">등록된 옷이 없어요. <Link to="/register">옷 등록</Link></p> : (
        <div className="pick-row">
          {items.map((g) => (
            <button key={g.id} type="button" className="pick" aria-pressed={selected === g.id} onClick={() => onPick(selected === g.id ? null : g.id)} aria-label={g.name}>
              <GarmentTile g={g} />
              <div className="pick-name">{g.name}</div>
              <div className="pick-flag">{g.templateLabel ?? '3D 미지원'}{!g.usable ? `, ${g.statusLabel}` : ''}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function SaveSheet({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSave(name)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }
  return (
    <Sheet title="코디 저장" onClose={onClose}>
      <form onSubmit={submit} className="form-grid" noValidate>
        <div className="field">
          <label htmlFor="outfit-name">코디 이름</label>
          <input id="outfit-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 출근 코디" maxLength={50} />
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

function AiPanel({ garments, seasons, currentSeason, onWear }: {
  garments: GarmentSummary[]; seasons: { value: string; label: string }[]; currentSeason: string
  onWear: (t: GarmentSummary, b: GarmentSummary) => void
}) {
  const [season, setSeason] = useState(currentSeason)
  const [occasion, setOccasion] = useState('')
  const [fixedId, setFixedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recs, setRecs] = useState<Recommendation[] | null>(null)

  async function ask() {
    setBusy(true)
    setError('')
    try {
      const r = await api.post<{ items: Recommendation[] }>('/api/recommendations', {
        season: season || null, occasion: occasion || null, fixedGarmentId: fixedId ? Number(fixedId) : null,
      })
      setRecs(r.items)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const usable = garments.filter((g) => g.usable && (isTop(g) || isBottom(g)))
  return (
    <div className="card" aria-label="AI 추천">
      <h2 className="section-title">AI 추천 <small>지금 입을 수 있는 내 옷으로만</small></h2>
      <div className="form-grid">
        <div className="field">
          <span className="field-label" id="ai-season">계절</span>
          <div className="chips wrap" role="group" aria-labelledby="ai-season" style={{ marginTop: 0 }}>
            {seasons.map((s) => <button key={s.value} type="button" className="chip" aria-pressed={season === s.value} onClick={() => setSeason(s.value)}>{s.label}</button>)}
          </div>
        </div>
        <div className="field">
          <span className="field-label" id="ai-occ">상황</span>
          <div className="chips wrap" role="group" aria-labelledby="ai-occ" style={{ marginTop: 0 }}>
            {OCCASIONS.map((o) => <button key={o} type="button" className="chip" aria-pressed={occasion === o} onClick={() => setOccasion(occasion === o ? '' : o)}>{o}</button>)}
          </div>
        </div>
        <div className="field">
          <label htmlFor="ai-fixed">꼭 입을 옷(선택)</label>
          <select id="ai-fixed" className="select" value={fixedId} onChange={(e) => setFixedId(e.target.value)}>
            <option value="">고르지 않음</option>
            {usable.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <p className="field-hint" style={{ margin: 0 }}>세탁 대기·세탁 중·수선 중인 옷은 추천에서 빠져요.</p>
        <button type="button" className="btn" onClick={ask} disabled={busy}>{busy ? <Spinner /> : <IconSparkle />}{busy ? '조합을 고르는 중' : '추천 받기'}</button>
        {error && <Notice kind="warn">{error}</Notice>}
      </div>

      {recs && recs.length === 0 && <div style={{ marginTop: 16 }}><Notice kind="info">조건에 맞는 조합이 없어요. 계절이나 상황을 바꿔 보세요.</Notice></div>}
      {recs && recs.length > 0 && (
        <div style={{ marginTop: 18 }} aria-label="추천 결과">
          {recs.map((r, i) => (
            <article className="rec" key={i} data-testid="recommendation">
              <div className="rec-pair">
                {[r.top, r.bottom].map((g) => (
                  <Link key={g.id} to={`/closet/${g.id}`} className="gcard" data-testid="recommended-garment">
                    <GarmentTile g={g} />
                    <div className="gcard-body"><p className="gcard-name">{g.name}</p></div>
                  </Link>
                ))}
              </div>
              <p className="rec-reason">{r.reason}</p>
              <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 10 }} onClick={() => onWear(r.top, r.bottom)}>3D로 입혀 보기</button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
