import { SLOT_LABEL, whereNow, wearableNow, type OutfitLook } from '../lib/outfit'
import { IconAlert, IconCheck } from './Icons'
import { OutfitThumb } from './OutfitPicker'
import { Spinner } from './Ui'

/** 저장한 코디. 지금 입을 수 있는지는 열 때마다 서버가 다시 계산한다. */
export default function OutfitSavedList({ looks, busyId, onWear, onDelete }: {
  looks: OutfitLook[]
  busyId: number | null
  onWear: (look: OutfitLook) => void
  onDelete: (look: OutfitLook) => void
}) {
  if (looks.length === 0) {
    return (
      <div className="empty outfit-empty">
        <strong>저장한 코디가 없어요</strong>
        <p>마음에 드는 조합을 저장해 두면 다음에 바로 꺼내 입을 수 있어요.</p>
      </div>
    )
  }
  return (
    <ul className="outfit-saved">
      {looks.map((look) => {
        const away = look.items.filter((i) => !wearableNow(i.garment))
        return (
          <li key={look.id} className="outfit-look" data-testid="outfit-look">
            <button type="button" className="outfit-look-main" onClick={() => onWear(look)} disabled={!look.wearableNow} aria-label={`${look.name} 다시 입혀 보기`}>
              <span className="outfit-look-thumbs">
                {look.items.map((i) => <OutfitThumb key={i.slot} g={i.garment} className="outfit-mini" />)}
              </span>
              <span className="outfit-look-text">
                <b>{look.name}</b>
                <small>{look.items.map((i) => `${SLOT_LABEL[i.slot]} ${i.garment.name}`).join(' · ')}</small>
              </span>
            </button>
            {look.wearableNow ? (
              <p className="outfit-look-state ok"><IconCheck />지금 입을 수 있어요</p>
            ) : (
              <div className="outfit-look-state warn">
                <IconAlert />
                <div>
                  {away.length ? '지금 꺼낼 수 없는 옷이 있어요' : '옷이 지워져 빈 코디예요'}
                  {away.length > 0 && (
                    <ul>{away.map((i) => <li key={i.slot}><b>{i.garment.name}</b> {whereNow(i.garment)}</li>)}</ul>
                  )}
                </div>
              </div>
            )}
            <button type="button" className="btn btn-sm btn-danger-text outfit-look-del" onClick={() => onDelete(look)} disabled={busyId !== null} aria-label={`${look.name} 삭제`}>
              {busyId === look.id ? <Spinner /> : '삭제'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
