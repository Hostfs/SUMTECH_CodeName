import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../api'
import OutfitPicker, { OutfitThumb } from '../components/OutfitPicker'
import OutfitSavedList from '../components/OutfitSavedList'
import StudioStage from '../components/StudioStage'
import { IconPin, IconSparkle } from '../components/Icons'
import { Loading, Notice, Sheet, Spinner, Toast } from '../components/Ui'
import {
  SLOTS, SLOT_LABEL, pickedItems, picksFrom, slotOf, toggle, wearableNow,
  type OutfitLook, type OutfitSuggestion, type Picks, type Slot,
} from '../lib/outfit'
import type { GarmentSummary } from '../types'
import '../styles/outfit.css'

/**
 * 코디: 지금 바로 꺼내 입을 수 있는 옷(집 안·사용 가능)으로만 조합한다.
 * 고른 옷마다 놓인 자리('옷장 A → 왼쪽 행거')를 보여 줘 바로 꺼낼 수 있게 한다.
 */
export default function Outfit() {
  const [garments, setGarments] = useState<GarmentSummary[] | null>(null)
  const [looks, setLooks] = useState<OutfitLook[]>([])
  const [error, setError] = useState('')
  const [picks, setPicks] = useState<Picks>({})
  const [slot, setSlot] = useState<Slot>('TOP')
  const [reason, setReason] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    Promise.all([api.get<GarmentSummary[]>('/api/garments'), api.get<OutfitLook[]>('/api/outfits')])
      .then(([g, l]) => { setGarments(g); setLooks(l) })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  const { bySlot, hidden } = useMemo(() => {
    const by: Record<Slot, GarmentSummary[]> = { OUTER: [], TOP: [], BOTTOM: [], DRESS: [] }
    let away = 0
    for (const g of garments ?? []) {
      const s = slotOf(g)
      if (!s) continue
      if (wearableNow(g)) by[s].push(g)
      else away++
    }
    return { bySlot: by, hidden: away }
  }, [garments])

  const chosen = pickedItems(picks)

  async function suggest() {
    setSuggesting(true)
    setError('')
    try {
      const s = await api.get<OutfitSuggestion>('/api/outfits/suggest')
      setPicks(picksFrom(s.items))
      setReason(s.reason)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSuggesting(false)
    }
  }

  async function remove(look: OutfitLook) {
    setDeleting(look.id)
    setError('')
    try {
      await api.del(`/api/outfits/${look.id}`)
      setLooks((l) => l.filter((x) => x.id !== look.id))
      setToast('코디를 지웠어요')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setDeleting(null)
    }
  }

  function wear(look: OutfitLook) {
    setPicks(picksFrom(look.items))
    setReason('')
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  if (!garments) {
    return (
      <>
        <div className="page-head"><h1 className="page-title">코디</h1></div>
        {error ? <Notice>{error}</Notice> : <Loading />}
      </>
    )
  }

  return (
    <div className="outfit-page">
      <div className="page-head"><h1 className="page-title">코디</h1></div>
      <p className="page-lead">지금 집에 있는 옷으로만 입혀 봐요. 고른 옷이 어디 있는지 바로 알려 드려요.</p>
      {error && <div className="outfit-gap"><Notice>{error}</Notice></div>}

      <div className="outfit-studio">
        <div className="outfit-viewer">
          <div className="outfit-viewer-bar">
            {chosen.length ? chosen.map((i) => <span key={i.slot}>{SLOT_LABEL[i.slot]}</span>) : <span className="muted">아직 고른 옷이 없어요</span>}
          </div>
          <StudioStage picks={picks} />
        </div>

        <div className="outfit-side">
          <div className="outfit-actions">
            <button type="button" className="btn btn-soft" onClick={suggest} disabled={suggesting}>
              {suggesting ? <Spinner /> : <IconSparkle />}추천 받기
            </button>
            <button type="button" className="btn" onClick={() => setSaving(true)} disabled={chosen.length === 0}>저장</button>
          </div>
          {reason && <p className="outfit-reason" role="status">{reason}</p>}

          {chosen.length > 0 && (
            <ul className="outfit-chosen" aria-label="고른 옷과 위치">
              {chosen.map((i) => (
                <li key={i.slot}>
                  <OutfitThumb g={i.garment} />
                  <span className="outfit-chosen-text">
                    <small>{SLOT_LABEL[i.slot]}</small>
                    <b>{i.garment.name}</b>
                    <span className="outfit-loc"><IconPin />{i.garment.locationPath ?? '집 안'}</span>
                  </span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPicks((p) => toggle(p, i.slot, i.garment))} aria-label={`${i.garment.name} 빼기`}>빼기</button>
                </li>
              ))}
            </ul>
          )}

          <OutfitPicker slot={slot} onSlot={setSlot} bySlot={bySlot} picks={picks} onPick={(s, g) => setPicks((p) => toggle(p, s, g))} />
          {hidden > 0 && (
            <p className="outfit-hidden">박스·본가·세탁소에 있는 옷은 꺼낸 뒤에 고를 수 있어요 <b>{hidden}벌 숨김</b></p>
          )}
        </div>
      </div>

      <h2 className="section-title outfit-saved-title">저장한 코디<small>{looks.length}개</small></h2>
      <OutfitSavedList looks={looks} busyId={deleting} onWear={wear} onDelete={remove} />

      {saving && (
        <SaveSheet
          picks={picks}
          onClose={() => setSaving(false)}
          onSaved={(look) => { setLooks((l) => [look, ...l]); setSaving(false); setToast('코디를 저장했어요') }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  )
}

function SaveSheet({ picks, onClose, onSaved }: { picks: Picks; onClose: () => void; onSaved: (look: OutfitLook) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const items = pickedItems(picks)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onSaved(await api.post<OutfitLook>('/api/outfits', {
        name,
        items: items.map((i) => ({ slot: i.slot, garmentId: i.garment.id })),
      }))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Sheet title="코디 저장" onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="outfit-name">이름</label>
          <input id="outfit-name" className="input" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="예: 월요일 출근룩" autoComplete="off" />
        </div>
        <div className="outfit-save-preview">
          {SLOTS.filter((s) => picks[s]).map((s) => <OutfitThumb key={s} g={picks[s]!} className="outfit-mini" />)}
          <span>{items.length}벌</span>
        </div>
        {error && <div className="outfit-gap"><Notice>{error}</Notice></div>}
        <div className="sheet-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
          <button type="submit" className="btn" disabled={busy || name.trim() === ''}>{busy && <Spinner />}저장</button>
        </div>
      </form>
    </Sheet>
  )
}
