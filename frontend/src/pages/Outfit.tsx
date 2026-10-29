import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../api'
import { Icon } from '../components/Icon'
import OutfitPicker, { SlotBubbles, Thumb } from '../components/OutfitPicker'
import OutfitSavedList, { Mini } from '../components/OutfitSavedList'
import Studio2D from '../components/Studio2D'
import { Loading, Notice, Sheet, Spinner, Toast } from '../components/Ui'
import { loadFits, saveFits, type Fit } from '../lib/fit'
import {
  SLOT_LABEL, choose, eul, pickedItems, picksFrom, slotOf, wearableNow,
  type OutfitLook, type OutfitSuggestion, type Picks, type Slot,
} from '../lib/outfit'
import type { GarmentSummary } from '../types'
import '../styles/outfit.app.css'

const isWide = () => window.matchMedia('(min-width: 960px)').matches
const toTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })

/**
 * 코디 스튜디오(디자인 초안 otgyeol-frontend Outfit 그대로): 2D 마네킹 양옆 말풍선으로 자리를 고르고, 아래 트레이에서 옷을 고르면 바로 입혀진다.
 * 고를 수 있는 옷은 지금 집 안에 있고 입을 수 있는 옷뿐이고(R13), 고른 옷마다 꺼낼 자리('옷장 A → 왼쪽 행거')를 함께 보여 준다.
 * '추천 받기'는 이번 계절에 맞는 집 안 옷으로 채우고 이유를 알려 준다. PC는 마네킹 왼쪽, 고르기·고른 옷·저장한 코디 오른쪽.
 */
export default function Outfit() {
  const [garments, setGarments] = useState<GarmentSummary[] | null>(null)
  const [looks, setLooks] = useState<OutfitLook[]>([])
  const [error, setError] = useState('')
  const [picks, setPicks] = useState<Picks>({})
  // 직접 입히기 / 추천 받기(추천으로 채운 상태면 이유를 보여 준다)
  const [mode, setMode] = useState<'dress' | 'ai'>('dress')
  const [reason, setReason] = useState('')
  const [slot, setSlot] = useState<Slot>('TOP')
  const [trayOpen, setTrayOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [fits, setFits] = useState<Record<number, Fit>>(loadFits)
  const [suggesting, setSuggesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  useEffect(() => {
    let alive = true
    Promise.all([
      api.get<GarmentSummary[]>('/api/garments'),
      api.get<OutfitLook[]>('/api/outfits'),
      api.get<OutfitSuggestion>('/api/outfits/suggest').catch(() => null),
    ])
      .then(([g, l, s]) => {
        if (!alive) return
        setGarments(g)
        setLooks(l)
        // 처음에는 이번 계절에 맞는 집 안 옷을 입혀 둔다. 아우터는 기본이 '없음'이다(초안과 같다).
        if (s) setPicks(picksFrom(s.items.filter((i) => i.slot !== 'OUTER')))
      })
      .catch((e) => alive && setError(errorMessage(e)))
    return () => { alive = false }
  }, [])

  // 휴대폰 트레이는 Esc로 닫는다
  useEffect(() => {
    if (!trayOpen) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setTrayOpen(false)
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [trayOpen])

  // 자리별로 지금 입을 수 있는 옷만. 박스·본가·세탁소·미배치 옷은 숨기고 벌 수만 센다.
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

  /** 말풍선: 휴대폰은 트레이를 열고 닫고, PC는 오른쪽 목록의 자리만 바꾼다. 고른 옷 목록에서 누르면 늘 연다 */
  function openSlot(s: Slot, toggle = true) {
    if (toggle && !isWide() && trayOpen && slot === s) {
      setTrayOpen(false)
      return
    }
    setSlot(s)
    setTrayOpen(true)
    if (!isWide()) toTop()
  }

  function pick(s: Slot, g: GarmentSummary | null) {
    setPicks((p) => choose(p, s, g))
    setMode('dress')
    setReason('')
  }

  function dressMyself() {
    setMode('dress')
    setReason('')
    if (!isWide()) {
      setTrayOpen(true)
      toTop()
    }
  }

  async function suggest() {
    setSuggesting(true)
    setError('')
    try {
      const s = await api.get<OutfitSuggestion>('/api/outfits/suggest')
      setPicks(picksFrom(s.items))
      setReason(s.reason)
      setMode('ai')
      setTrayOpen(false)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSuggesting(false)
    }
  }

  /** 저장한 코디를 다시 입혀 본다. 그사이 꺼낼 수 없게 된 옷은 빼고 입힌다. */
  function wear(look: OutfitLook) {
    const ready = look.items.filter((i) => wearableNow(i.garment))
    setPicks(picksFrom(ready))
    setMode('dress')
    setReason('')
    setTrayOpen(false)
    const away = look.items.length - ready.length
    setToast(away ? `지금 꺼낼 수 없는 옷 ${away}벌은 빼고 입혔어요` : `${eul(look.name)} 입혔어요`)
    toTop()
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

  function setFit(g: GarmentSummary, f: Fit) {
    const next = { ...fits, [g.id]: f }
    setFits(next)
    saveFits(next)
  }

  const head = <header className="page-head page-title-row"><h1>코디 스튜디오</h1></header>

  if (!garments) {
    return (
      <div className="page pinned outfit">
        <div className="pin">{head}</div>
        {error ? <Notice>{error}</Notice> : <Loading />}
      </div>
    )
  }

  return (
    <div className="page pinned outfit" data-tray={trayOpen ? 'open' : 'closed'}>
      <div className="pin">
        {head}
        <div className="seg" role="group" aria-label="코디 방식">
          <button type="button" data-on={mode === 'dress'} aria-pressed={mode === 'dress'} onClick={dressMyself}>직접 입히기</button>
          <button type="button" data-on={mode === 'ai'} aria-pressed={mode === 'ai'} onClick={suggest} disabled={suggesting}>
            {suggesting ? <Spinner /> : <Icon name="sparkle" size={13} />} 추천 받기
          </button>
        </div>
      </div>

      {error && <div className="outfit-error"><Notice>{error}</Notice></div>}

      <div className="outfit-studio">
        <div className="viewer2">
          {/* 정보 줄은 모형 위에 겹치지 않도록 따로 둔다 */}
          <div className="vbar vbar-top">
            <span>기본 체형 170cm</span>
            {chosen.map((i) => <span key={i.slot}>{i.garment.name}</span>)}
          </div>
          <div className="vstage">
            <Studio2D picks={picks} fits={fits} zoom={zoom} />
            <SlotBubbles picks={picks} slot={slot} open={trayOpen} onSlot={openSlot} />
            <div className="vtools">
              <button type="button" onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(1)))} aria-label="확대"><Icon name="plus" size={17} /></button>
              <button type="button" onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.2).toFixed(1)))} aria-label="축소"><span className="minus" /></button>
            </div>
          </div>
          {mode === 'ai' && reason && (
            <p className="vbar vbar-bot" role="status"><Icon name="sparkle" size={13} /><small>{reason}</small></p>
          )}
        </div>

        <div className="outfit-side">
          <OutfitPicker slot={slot} list={bySlot[slot]} current={picks[slot] ?? null} open={trayOpen} fit={picks[slot] ? fits[picks[slot]!.id] : undefined}
            onPick={(g) => pick(slot, g)} onFit={setFit} onClose={() => setTrayOpen(false)} />
          {hidden > 0 && (
            <p className="outfit-hidden">
              <Icon name="box" size={16} />
              <span>박스·본가·세탁소에 있거나 자리가 정해지지 않은 옷은 꺼낸 뒤에 고를 수 있어요.</span>
              <b>{hidden}벌 숨김</b>
            </p>
          )}

          <h2 className="rail-title">고른 옷과 위치 <small>{chosen.length}벌</small></h2>
          {chosen.length === 0 ? (
            <p className="muted-text">마네킹 옆 말풍선을 눌러 옷을 고르거나 ‘추천 받기’를 눌러 보세요.</p>
          ) : (
            <ul className="worn-list" aria-label="고른 옷과 위치">
              {chosen.map((i) => (
                <li key={i.slot} className="worn">
                  {/* 누르면 그 자리의 옷 목록이 열려 바로 바꿔 입힌다 */}
                  <button type="button" className="worn-main" onClick={() => openSlot(i.slot, false)}>
                    <span className="worn-art" aria-hidden="true"><Thumb g={i.garment} size={40} /></span>
                    <span className="worn-text">
                      <small>{SLOT_LABEL[i.slot]}</small>
                      <b>{i.garment.name}</b>
                      <span className="worn-loc"><Icon name="pin" size={13} stroke={2} />{i.garment.locationPath ?? '집 안'}</span>
                    </span>
                  </button>
                  <button type="button" className="icon-btn" onClick={() => pick(i.slot, null)} aria-label={`${i.garment.name} 빼기`}><Icon name="close" size={18} /></button>
                </li>
              ))}
            </ul>
          )}

          <button type="button" className="btn btn-primary btn-block save-btn" disabled={chosen.length === 0} onClick={() => { setTrayOpen(false); setSaving(true) }}>저장</button>

          <h2 className="rail-title">저장한 코디 <small>{looks.length}개</small></h2>
          <OutfitSavedList looks={looks} busyId={deleting} onWear={wear} onDelete={remove} />
        </div>
      </div>

      {saving && (
        <SaveSheet
          picks={picks}
          onClose={() => setSaving(false)}
          onSaved={(look) => { setLooks((l) => [look, ...l]); setSaving(false); setToast(`${eul(look.name)} 저장했어요`) }}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}

/** 코디 저장(초안 시트 그대로). 박스 속 옷 등 지금 꺼낼 수 없는 옷이 섞이면 서버가 위치를 알려 주며 거절한다. */
function SaveSheet({ picks, onClose, onSaved }: { picks: Picks; onClose: () => void; onSaved: (look: OutfitLook) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const items = pickedItems(picks)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError('')
    try {
      onSaved(await api.post<OutfitLook>('/api/outfits', {
        name: name.trim(),
        items: items.map((i) => ({ slot: i.slot, garmentId: i.garment.id })),
      }))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Sheet title="코디 저장" onClose={onClose}
      footer={<button type="submit" form="outfit-save" className="btn btn-primary btn-block" disabled={busy || !name.trim()}>{busy && <Spinner />}저장</button>}>
      <form id="outfit-save" className="fields" onSubmit={save}>
        <div className="saving-preview"><Mini items={items.map((i) => i.garment)} /><span>{items.map((i) => i.garment.name).join(' + ')}</span></div>
        <label className="field">
          <span>코디 이름</span>
          <input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="예: 출근 코디" autoComplete="off" />
        </label>
        {error && <Notice>{error}</Notice>}
      </form>
    </Sheet>
  )
}
