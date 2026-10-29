import { Link } from 'react-router-dom'
import type { GarmentSummary } from '../types'
import GarmentArt from './GarmentArt'
import { IconPin, IconPinQuestion } from './Icons'
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

export default function GarmentCard({ g }: { g: GarmentSummary }) {
  return (
    <Link to={`/closet/${g.id}`} className="gcard" data-testid="garment-card">
      <GarmentTile g={g} />
      <div className="gcard-body">
        <p className="gcard-name">{g.name}</p>
        <LocationLine g={g} />
      </div>
    </Link>
  )
}
