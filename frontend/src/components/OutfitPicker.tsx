import type { GarmentSummary } from '../types'
import { SLOTS, SLOT_LABEL, type Picks, type Slot } from '../lib/outfit'
import GarmentArt from './GarmentArt'
import { IconCheck } from './Icons'

/** 옷 썸네일(사진 또는 일러스트). */
export function OutfitThumb({ g, className = 'outfit-thumb' }: { g: GarmentSummary; className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {g.imageUrl ? <img src={g.imageUrl} alt="" loading="lazy" /> : <GarmentArt subType={g.subType} colorHex={g.colorHex} />}
    </span>
  )
}

/** 자리 탭(아우터·상의·하의·원피스)과 그 자리에 넣을 수 있는 옷의 가로 목록. */
export default function OutfitPicker({ slot, onSlot, bySlot, picks, onPick }: {
  slot: Slot
  onSlot: (s: Slot) => void
  bySlot: Record<Slot, GarmentSummary[]>
  picks: Picks
  onPick: (s: Slot, g: GarmentSummary) => void
}) {
  const list = bySlot[slot]
  return (
    <section className="outfit-picker" aria-label="옷 고르기">
      <div className="outfit-slots" role="tablist" aria-label="자리">
        {SLOTS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={slot === s} onClick={() => onSlot(s)}>
            {SLOT_LABEL[s]}
            {picks[s] ? <span className="outfit-dot" aria-label="고름" /> : <small>{bySlot[s].length}</small>}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="outfit-rail-empty">지금 집 안에 있는 {SLOT_LABEL[slot]}가 없어요.</p>
      ) : (
        <div className="outfit-rail" role="tabpanel" aria-label={`${SLOT_LABEL[slot]} 목록`}>
          {list.map((g) => {
            const on = picks[slot]?.id === g.id
            return (
              <button key={g.id} type="button" className="outfit-pick" aria-pressed={on} onClick={() => onPick(slot, g)} title={g.locationPath ?? undefined}>
                <span className="outfit-pick-art">
                  <OutfitThumb g={g} className="outfit-pick-img" />
                  {on && <span className="outfit-pick-check"><IconCheck /></span>}
                </span>
                <span className="outfit-pick-name">{g.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
