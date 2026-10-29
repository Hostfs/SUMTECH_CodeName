import { Link, useLocation } from 'react-router-dom'
import { useSession } from '../session'

const TABS = [
  { to: '/map', label: '옷장 지도' },
  { to: '/care', label: '관리함' },
  { to: '/move', label: '옮기기' },
]

/** 보관함 머리: 제목과 옷장 지도·관리함·옮기기를 오가는 위쪽 탭(주소가 바뀌는 링크). */
export default function StorageTabs() {
  const { pathname } = useLocation()
  const { careBadge } = useSession()
  return (
    <>
      <div className="page-head"><h1 className="page-title">보관함</h1></div>
      <nav className="storage-seg" aria-label="보관함 보기">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} className="storage-seg-link" aria-current={pathname === t.to ? 'page' : undefined}>
            {t.label}
            {t.to === '/care' && careBadge > 0 && <span className="storage-seg-dot" aria-label={`처리할 관리 ${careBadge}건`}>{careBadge}</span>}
          </Link>
        ))}
      </nav>
    </>
  )
}
