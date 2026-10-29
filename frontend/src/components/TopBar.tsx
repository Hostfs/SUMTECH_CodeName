import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import { formatDate } from '../format'
import { useSession } from '../session'
import type { Board, GarmentSummary } from '../types'
import { IconBell, IconLogout } from './Icons'

type Notice = { key: string; tone: 'danger' | 'accent' | 'muted'; title: string; sub: string; to: string }

/** 알림: 관리함의 기한 지남·오늘 회수, 위치가 없는 옷. 열 때마다 새로 읽는다. */
function useNotices(open: boolean) {
  const [items, setItems] = useState<Notice[] | null>(null)
  useEffect(() => {
    if (!open) return
    let alive = true
    Promise.all([api.get<Board>('/api/care'), api.get<GarmentSummary[]>('/api/garments')])
      .then(([board, garments]) => {
        if (!alive) return
        const list: Notice[] = [
          ...board.overdue.map((i) => ({
            key: `o${i.care.id}`, tone: 'danger' as const, title: `${i.garment.name} 회수 기한이 지났어요`,
            sub: `${i.care.shopName ?? i.care.placeLabel} · ${formatDate(i.care.dueOn)} 회수 예정이었어요`, to: '/care',
          })),
          ...board.dueToday.map((i) => ({
            key: `t${i.care.id}`, tone: 'accent' as const, title: `오늘 ${i.garment.name}을(를) 찾아오세요`,
            sub: `${i.care.shopName ?? i.care.placeLabel} · ${i.care.careTypeLabel}`, to: '/care',
          })),
        ]
        const unplaced = garments.filter((g) => g.locationKind === 'UNPLACED' && g.status !== 'RETURNED_UNPLACED')
        if (unplaced.length) {
          list.push({ key: 'u', tone: 'muted', title: `위치가 없는 옷 ${unplaced.length}벌`, sub: `${unplaced[0].name}${unplaced.length > 1 ? ` 외 ${unplaced.length - 1}벌` : ''} · 옷장 지도에서 넣을 곳을 정해요`, to: '/map' })
        }
        const returned = garments.filter((g) => g.status === 'RETURNED_UNPLACED')
        if (returned.length) {
          list.push({ key: 'r', tone: 'accent', title: `돌려받은 옷 ${returned.length}벌의 자리를 확인하세요`, sub: `${returned[0].name} · 옷 정보에서 ‘재배치 확인’`, to: `/closet/${returned[0].id}` })
        }
        setItems(list)
      })
      .catch(() => alive && setItems([]))
    return () => { alive = false }
  }, [open])
  return items
}

/** 화면 위 오른쪽: 알림 종과 계정(이메일·로그아웃). 휴대폰·PC 같은 자리에 둔다. */
export default function TopBar() {
  const { me, careBadge, logout } = useSession()
  const box = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  // 화면을 옮기면 열린 창은 닫힌다(연 화면 주소와 함께 기억해 다른 주소에서는 닫힌 것으로 본다).
  const [opened, setOpened] = useState<{ at: string; panel: 'notice' | 'account' } | null>(null)
  const panel = opened && opened.at === pathname ? opened.panel : null
  const setPanel = (p: 'notice' | 'account' | null) => setOpened(p ? { at: pathname, panel: p } : null)
  const notices = useNotices(panel === 'notice')

  useEffect(() => {
    if (!panel) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpened(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [panel])

  const initial = (me?.email ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="topbar" ref={box}>
      <button type="button" className="topbar-bell" aria-label={careBadge ? `알림 ${careBadge}건` : '알림'} aria-expanded={panel === 'notice'}
        onClick={() => setPanel(panel === 'notice' ? null : 'notice')}>
        <IconBell />
        {careBadge > 0 && <span className="topbar-dot">{careBadge}</span>}
      </button>
      <button type="button" className="topbar-account" aria-expanded={panel === 'account'} aria-label="계정 메뉴"
        onClick={() => setPanel(panel === 'account' ? null : 'account')}>
        <span className="avatar" aria-hidden>{initial}</span>
        <span className="topbar-email">{me?.email}</span>
      </button>

      {panel === 'notice' && (
        <div className="pop" role="dialog" aria-label="알림">
          <div className="pop-head">알림</div>
          {notices === null ? <p className="pop-empty">불러오는 중…</p>
            : notices.length === 0 ? <p className="pop-empty">챙길 일이 없어요. 맡긴 옷과 옷 위치가 모두 정리돼 있어요.</p>
              : (
                <ul className="pop-list">
                  {notices.map((n) => (
                    <li key={n.key}>
                      <Link to={n.to} className={`pop-item ${n.tone}`}>
                        <span className="pop-mark" aria-hidden />
                        <span><strong>{n.title}</strong><small>{n.sub}</small></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
        </div>
      )}
      {panel === 'account' && (
        <div className="pop pop-account" role="dialog" aria-label="계정">
          <div className="pop-me"><span className="avatar lg" aria-hidden>{initial}</span><span>{me?.email}</span></div>
          <button type="button" className="pop-logout" onClick={logout}><IconLogout />로그아웃</button>
        </div>
      )}
    </div>
  )
}
