import { useRef, type KeyboardEvent } from 'react'
import { ShapeArt } from './GarmentArt'
import { Icon } from './Icon'
import { DEFAULT_FIT, studioShape, type Fit } from '../lib/fit'
import { SLOTS, SLOT_LABEL, SLOT_SIDE, type Picks, type Slot } from '../lib/outfit'
import type { GarmentSummary } from '../types'

/** 옷 사진이 있으면 사진을, 없으면 코디 화면과 같은 모양의 그림을 size(px) 정사각형으로(초안 GarmentImage) */
export function Thumb({ g, size }: { g: GarmentSummary; size: number }) {
  return g.imageUrl
    ? <img className="o-photo" src={g.imageUrl} alt="" width={size} height={size} loading="lazy" draggable={false} />
    : <ShapeArt shape={studioShape(g)} hex={g.colorHex} size={size} />
}

/**
 * 마네킹 양옆의 말풍선(초안 bubble) = 자리 탭. 누르면 그 자리의 옷 목록(트레이)이 열린다.
 * 고른 옷이 있으면 ? 대신 그 옷이 보인다. 화살표 키로 자리를 옮겨 다닌다.
 */
export function SlotBubbles({ picks, slot, open, onSlot }: { picks: Picks; slot: Slot; open: boolean; onSlot: (s: Slot) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    refs.current[(i + d + SLOTS.length) % SLOTS.length]?.focus()
  }
  return (
    <div className="bubbles" role="tablist" aria-label="옷 자리">
      {SLOTS.map((s, i) => {
        const g = picks[s]
        return (
          <button key={s} ref={(el) => { refs.current[i] = el }} type="button" role="tab" className="bubble"
            data-slot={s.toLowerCase()} data-side={SLOT_SIDE[s]} data-on={open && slot === s} data-filled={!!g}
            aria-selected={slot === s} aria-controls="outfit-slot-panel" tabIndex={slot === s ? 0 : -1}
            aria-label={`${SLOT_LABEL[s]} 고르기${g ? `, 지금: ${g.name}` : ''}`}
            onClick={() => onSlot(s)} onKeyDown={(e) => onKey(e, i)}>
            <span className="bub-ico" aria-hidden="true">{g ? <Thumb g={g} size={24} /> : <i>?</i>}</span>
            <span className="bub-lab">{SLOT_LABEL[s]}</span>
          </button>
        )
      })}
    </div>
  )
}

function PickTile({ g, on, onPick }: { g: GarmentSummary | null; on: boolean; onPick: () => void }) {
  return (
    <button type="button" className="pick" data-on={on} onClick={onPick} aria-pressed={on} title={g?.locationPath ?? undefined}>
      <span className="pick-art" aria-hidden="true">{g ? <Thumb g={g} size={46} /> : <Icon name="close" size={20} />}</span>
      <span className="pick-name">{g ? g.name : '선택 안 함'}</span>
    </button>
  )
}

/**
 * 고른 자리의 옷 목록(초안 Tray). 휴대폰은 모형을 가리지 않는 낮은 트레이로 아래에서 올라오고,
 * PC는 오른쪽 단에 늘 펼쳐 둔다. 고를 때마다 마네킹이 바로 바뀐다. 사진 옷은 품·기장을 맞출 수 있다.
 */
export default function OutfitPicker({ slot, list, current, open, fit, onPick, onFit, onClose }: {
  slot: Slot
  list: GarmentSummary[]
  current: GarmentSummary | null
  open: boolean
  fit: Fit | undefined
  onPick: (g: GarmentSummary | null) => void
  onFit: (g: GarmentSummary, fit: Fit) => void
  onClose: () => void
}) {
  const label = SLOT_LABEL[slot]
  const f = fit ?? DEFAULT_FIT
  return (
    <section className="tray" data-open={open} aria-label={`${label} 고르기`}>
      <div className="tray-head">
        <b>{label}</b>
        <small>{current ? current.name : '선택 안 함'}</small>
        <button type="button" className="btn-text tray-done" onClick={onClose}>완료</button>
      </div>
      {list.length === 0 ? (
        <p className="muted-text tray-empty" role="tabpanel" id="outfit-slot-panel" aria-label={`${label} 목록`}>
          지금 집 안에 꺼내 입을 수 있는 {label}가 없어요.
        </p>
      ) : (
        <div className="rail" role="tabpanel" id="outfit-slot-panel" aria-label={`${label} 목록`}>
          <PickTile g={null} on={!current} onPick={() => onPick(null)} />
          {list.map((g) => <PickTile key={g.id} g={g} on={current?.id === g.id} onPick={() => onPick(g)} />)}
        </div>
      )}
      {current?.imageUrl && (
        <div className="fit-row" role="group" aria-label="핏 조절">
          <label>품<input type="range" min="0.8" max="1.3" step="0.02" value={f.width} onChange={(e) => onFit(current, { ...f, width: Number(e.target.value) })} /></label>
          <label>기장<input type="range" min="0.8" max="1.25" step="0.02" value={f.length} onChange={(e) => onFit(current, { ...f, length: Number(e.target.value) })} /></label>
        </div>
      )}
    </section>
  )
}
