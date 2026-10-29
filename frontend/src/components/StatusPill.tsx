import { Icon, type IconName } from './Icon'

/** 상태별 아이콘과 배지 색(디자인 초안 GarmentCard의 badge-care·badge-none). */
const LOOK: Record<string, { icon: IconName; tone: 'care' | 'none' }> = {
  WASHING: { icon: 'drop', tone: 'care' },
  REPAIRING: { icon: 'scissors', tone: 'care' },
  RETURNED_UNPLACED: { icon: 'pin', tone: 'care' },
  WASH_WAITING: { icon: 'drop', tone: 'none' },
  PENDING: { icon: 'shirt', tone: 'none' },
  UNPLACED: { icon: 'pin', tone: 'none' },
}

/**
 * 상태 배지(디자인 초안 .badge). 보관 중은 표시하지 않고, 그 밖의 상태만 아이콘과 문구로 보여 준다(색만으로 전달하지 않음).
 * 카드 타일 위에는 작은 배지, 옷 상세 제목 옆에는 size="lg".
 * status에 'UNPLACED'를 넘기면 위치가 없는 옷의 '미배치' 배지가 된다.
 */
export default function StatusPill({ status, label, size }: { status: string; label: string; size?: 'lg' }) {
  if (status === 'STORED') return null
  const look = LOOK[status] ?? { icon: 'alert', tone: 'none' }
  return (
    <span className={`badge badge-${look.tone}${size === 'lg' ? ' badge-lg' : ''}`}>
      <Icon name={look.icon} size={size === 'lg' ? 13 : 11} stroke={2.2} />
      {label}
    </span>
  )
}
