import { whereNow, wearableNow, type OutfitLook } from '../lib/outfit'
import type { GarmentSummary } from '../types'
import { Icon } from './Icon'
import { Thumb } from './OutfitPicker'
import { Spinner } from './Ui'

/** 코디 한 벌을 작은 그림으로(초안 Mini) */
export function Mini({ items }: { items: GarmentSummary[] }) {
  return (
    <span className="mini-pair" aria-hidden="true">
      {items.map((g) => <Thumb key={g.id} g={g} size={30} />)}
    </span>
  )
}

/**
 * 저장한 코디(초안 saved 목록). 누르면 다시 입혀 보고, 지금 입을 수 있는지는 열 때마다 서버가 다시 계산한다.
 * 그사이 박스·세탁소로 간 옷이 있으면 그 옷과 지금 위치를 보여 준다.
 */
export default function OutfitSavedList({ looks, busyId, onWear, onDelete }: {
  looks: OutfitLook[]
  busyId: number | null
  onWear: (look: OutfitLook) => void
  onDelete: (look: OutfitLook) => void
}) {
  if (looks.length === 0) return <p className="muted-text">아직 저장한 코디가 없어요. 마음에 드는 조합을 저장해 두면 다음에 바로 꺼내 입을 수 있어요.</p>
  return (
    <ul className="plain-list">
      {looks.map((look) => {
        const away = look.items.filter((i) => !wearableNow(i.garment))
        return (
          <li key={look.id} className="saved look" data-testid="outfit-look">
            <button type="button" className="saved-main" onClick={() => onWear(look)} aria-label={`${look.name} 다시 입혀 보기`}>
              <Mini items={look.items.map((i) => i.garment)} />
              <span>
                <b>{look.name}</b>
                <small>{look.items.map((i) => i.garment.name).join(' + ')}</small>
              </span>
            </button>
            <button type="button" className="icon-btn" onClick={() => onDelete(look)} disabled={busyId !== null} aria-label={`${look.name} 삭제`}>
              {busyId === look.id ? <Spinner /> : <Icon name="trash" size={18} />}
            </button>
            {look.wearableNow ? (
              <p className="look-state ok"><Icon name="check" size={14} stroke={2.4} />지금 입을 수 있어요</p>
            ) : (
              <div className="look-state warn">
                <Icon name="alert" size={15} stroke={2} />
                <div>
                  <p>{away.length ? '지금 꺼낼 수 없는 옷이 있어요' : '옷이 지워져 빈 코디예요'}</p>
                  {away.length > 0 && (
                    <ul>{away.map((i) => <li key={i.slot}><b>{i.garment.name}</b> {whereNow(i.garment)}</li>)}</ul>
                  )}
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
