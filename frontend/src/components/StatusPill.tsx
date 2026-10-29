import type { ReactNode } from 'react'
import { IconBasket, IconNeedle, IconPinQuestion, IconShirt, IconWash } from './Icons'

/** 보관 중은 표시하지 않고, 그 밖의 상태만 아이콘과 문구로 타일 위에 보여 준다(색만으로 전달하지 않음). */
export default function StatusPill({ status, label }: { status: string; label: string }) {
  if (status === 'STORED') return null
  const map: Record<string, { cls: string; icon: ReactNode }> = {
    WASHING: { cls: 'away', icon: <IconWash /> },
    REPAIRING: { cls: 'away', icon: <IconNeedle /> },
    RETURNED_UNPLACED: { cls: 'check', icon: <IconPinQuestion /> },
    WASH_WAITING: { cls: 'wait', icon: <IconBasket /> },
    PENDING: { cls: 'wait', icon: <IconShirt /> },
  }
  const m = map[status] ?? { cls: 'wait', icon: null }
  return <span className={`status-pill ${m.cls}`}>{m.icon}{label}</span>
}
