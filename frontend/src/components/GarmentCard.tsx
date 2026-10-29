import { Link } from 'react-router-dom'
import type { GarmentSummary } from '../types'
import GarmentArt from './GarmentArt'
import { Icon } from './Icon'
import StatusPill from './StatusPill'

type Pictured = Pick<GarmentSummary, 'name' | 'imageUrl' | 'subType' | 'colorHex'>

/**
 * 대표 이미지(디자인 초안 GarmentImage): 사진이 있으면 사진을, 없으면 종류·색으로 그린 그림을 보여 준다.
 * size는 칸에 대한 비율('64%')이고, 칸을 가득 덮는 .gfill 안에서 가운데에 비율을 지킨 채 맞춘다.
 * 카드처럼 옷 이름이 바로 옆에 있으면 alt는 비워 둔다.
 */
export function GarmentPicture({ g, size = '64%', alt = '' }: { g: Pictured; size?: string; alt?: string }) {
  return (
    <span className="gfill">
      {g.imageUrl
        ? <img src={g.imageUrl} alt={alt} loading="lazy" draggable={false} style={{ maxWidth: size, maxHeight: size, objectFit: 'contain', display: 'block' }} />
        : <GarmentArt subType={g.subType} colorHex={g.colorHex} size={size} title={alt || undefined} />}
    </span>
  )
}

/** 위치가 없는 옷인지(세탁·수선 중이거나 돌려받아 확인할 옷은 따로 표시한다). */
const unplaced = (g: GarmentSummary) => !g.locationPath && g.locationKind === 'UNPLACED' && g.status !== 'RETURNED_UNPLACED'

/** 타일 위 오른쪽 배지: 보관 중이 아닌 상태와 미배치. */
function Badges({ g }: { g: GarmentSummary }) {
  return (
    <span className="gbadges">
      <StatusPill status={g.status} label={g.statusLabel} />
      {unplaced(g) && <StatusPill status="UNPLACED" label="미배치" />}
    </span>
  )
}

/** 옷 그림 칸(배지 + 대표 이미지). */
export function GarmentTile({ g }: { g: GarmentSummary }) {
  return (
    <span className="gtile">
      <Badges g={g} />
      <GarmentPicture g={g} />
    </span>
  )
}

/** 위치 줄: 확정 위치, 집에 없음, 확인 필요, 미배치를 구분한다. */
export function LocationLine({ g }: { g: GarmentSummary }) {
  let text: string
  if (g.locationPath) {
    // 박스 속·집 밖이면 바로 꺼낼 수 없다는 것을 앞에 붙인다.
    const away = g.locationKind === 'BOX' || g.locationKind === 'OFFSITE'
    text = `${away ? `${g.locationKindLabel} · ` : ''}${g.locationPath}`
  } else if (g.status === 'WASHING' || g.status === 'REPAIRING') {
    text = '지금 집에 없어요'
  } else if (g.status === 'RETURNED_UNPLACED') {
    text = '위치 확인 필요'
  } else {
    text = '위치를 정해 주세요'
  }
  return (
    <span className="gloc">
      <Icon name="pin" size={13} stroke={2} />
      <span className="gloc-text">{text}</span>
    </span>
  )
}

/**
 * 옷 카드(디자인 초안 GarmentCard). 상태는 색만으로 구분하지 않고 아이콘과 문구를 함께 쓴다.
 * selected를 넘기면 선택 모드: 눌러도 상세로 가지 않고 체크만 바뀐다.
 * onTakeOut을 넘기면 박스·집 밖에 있는 옷 카드 그림 위에 '꺼내기'가 붙는다(찾은 자리에서 바로 집 안 위치로 옮김).
 */
export default function GarmentCard({ g, selected, onToggle, onTakeOut }: {
  g: GarmentSummary; selected?: boolean; onToggle?: (id: number) => void; onTakeOut?: (g: GarmentSummary) => void
}) {
  if (onToggle) {
    return (
      <button type="button" className="gcard" data-testid="garment-card" data-selecting="true" data-selected={Boolean(selected)}
        aria-pressed={Boolean(selected)} onClick={() => onToggle(g.id)}>
        <span className="gtile">
          <span className="gcheck" aria-hidden="true">{selected && <Icon name="check" size={14} stroke={2.6} />}</span>
          <Badges g={g} />
          <GarmentPicture g={g} />
        </span>
        <span className="gname">{g.name}</span>
        <LocationLine g={g} />
      </button>
    )
  }
  const card = (
    <Link to={`/closet/${g.id}`} className="gcard" data-testid="garment-card">
      <GarmentTile g={g} />
      <span className="gname">{g.name}</span>
      <LocationLine g={g} />
    </Link>
  )
  if (!onTakeOut || !g.locationPath || (g.locationKind !== 'BOX' && g.locationKind !== 'OFFSITE')) return card
  return (
    <div className="gcard-wrap">
      {card}
      <button type="button" className="gtakeout" aria-label={`${g.name} 꺼내기`} onClick={() => onTakeOut(g)}>
        <Icon name="upload" size={14} stroke={2.2} />꺼내기
      </button>
    </div>
  )
}
