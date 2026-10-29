import { Link } from 'react-router-dom'
import type { GarmentSummary } from '../types'
import GarmentArt from './GarmentArt'
import { IconCheck, IconPin, IconPinQuestion, IconTakeOut } from './Icons'
import StatusPill from './StatusPill'

export function GarmentTile({ g }: { g: GarmentSummary }) {
  return (
    <div className="gcard-tile">
      {g.imageUrl ? <img src={g.imageUrl} alt="" loading="lazy" /> : <GarmentArt subType={g.subType} colorHex={g.colorHex} title={`${g.name} 그림`} />}
      <StatusPill status={g.status} label={g.statusLabel} />
    </div>
  )
}

/** 위치 줄: 확정 위치, 미배치, 집에 없음, 확인 필요를 구분한다. */
export function LocationLine({ g }: { g: GarmentSummary }) {
  if (g.locationPath) {
    // 박스 속·집 밖이면 바로 꺼낼 수 없다는 것을 앞에 붙인다.
    const prefix = g.locationKind === 'BOX' || g.locationKind === 'OFFSITE' ? `${g.locationKindLabel} · ` : ''
    return <div className={`gcard-loc${prefix ? ' away' : ''}`}><IconPin /><span>{prefix}{g.locationPath}</span></div>
  }
  if (g.status === 'WASHING' || g.status === 'REPAIRING') {
    return <div className="gcard-loc"><IconPin /><span>지금 집에 없어요</span></div>
  }
  if (g.status === 'RETURNED_UNPLACED') {
    return <div className="gcard-loc unplaced"><IconPinQuestion /><span>위치 확인 필요</span></div>
  }
  return <div className="gcard-loc unplaced"><IconPinQuestion /><span>미배치</span></div>
}

/**
 * 옷 카드. selected를 넘기면 선택 모드: 눌러도 상세로 가지 않고 체크만 바뀐다.
 * onTakeOut을 넘기면 박스·집 밖에 있는 옷 카드 아래에 '꺼내기'가 붙는다(찾은 자리에서 바로 집 안 위치로 옮김).
 */
export default function GarmentCard({ g, selected, onToggle, onTakeOut }: {
  g: GarmentSummary; selected?: boolean; onToggle?: (id: number) => void; onTakeOut?: (g: GarmentSummary) => void
}) {
  if (onToggle) {
    return (
      <button type="button" className="gcard gcard-select" data-testid="garment-card" aria-pressed={Boolean(selected)} onClick={() => onToggle(g.id)}>
        <GarmentTile g={g} />
        <span className="gcard-check" aria-hidden><IconCheck /></span>
        <div className="gcard-body">
          <p className="gcard-name">{g.name}</p>
          <LocationLine g={g} />
        </div>
      </button>
    )
  }
  const card = (
    <Link to={`/closet/${g.id}`} className="gcard" data-testid="garment-card">
      <GarmentTile g={g} />
      <div className="gcard-body">
        <p className="gcard-name">{g.name}</p>
        <LocationLine g={g} />
      </div>
    </Link>
  )
  if (!onTakeOut || !g.locationPath || (g.locationKind !== 'BOX' && g.locationKind !== 'OFFSITE')) return card
  return (
    <div className="gcard-wrap">
      {card}
      <button type="button" className="gcard-takeout" aria-label={`${g.name} 꺼내기`} onClick={() => onTakeOut(g)}>
        <IconTakeOut />꺼내기
      </button>
    </div>
  )
}
