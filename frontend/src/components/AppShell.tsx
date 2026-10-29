import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../session'
import { IconBox, IconHanger, IconHome, IconPlus, IconShirt } from './Icons'
import TopBar from './TopBar'

// 디자인 초안의 탭 구성: 홈 · 내 옷장 · (옷 등록) · 코디 · 보관함.
// 보관함은 옷장 지도(/map)·관리함(/care)·옮기기(/move)를 위쪽 탭으로 나눠 담는다.
const STORAGE_PATHS = ['/map', '/care', '/move']
const LINKS = [
  { to: '/home', label: '홈', icon: <IconHome /> },
  { to: '/closet', label: '내 옷장', icon: <IconHanger /> },
  { to: '/register', label: '옷 등록', icon: <IconPlus />, fab: true },
  { to: '/outfit', label: '코디', icon: <IconShirt /> },
  { to: '/map', label: '보관함', icon: <IconBox />, storage: true },
]

function isActive(pathname: string, to: string, storage?: boolean) {
  if (storage) return STORAGE_PATHS.includes(pathname)
  // 옷 상세(/closet/3)도 내 옷장 탭으로 본다.
  return pathname === to || pathname.startsWith(`${to}/`)
}

/** 로그인 후 화면 틀. 휴대폰은 하단 탭(가운데 옷 등록 버튼), PC는 왼쪽 메뉴. 메뉴 이름은 두 화면에서 같다. */
export default function AppShell() {
  const { careBadge } = useSession()
  const { pathname } = useLocation()
  const hasActionbar = /^\/closet\/\d+/.test(pathname)
  const onHome = pathname === '/home'
  const badge = careBadge > 0 ? <span className="badge" aria-label={`처리할 관리 ${careBadge}건`}>{careBadge}</span> : null

  return (
    <div className={`app with-nav${onHome ? ' on-home' : ''}`}>
      <nav className="rail" aria-label="주 메뉴">
        <Link to="/home" className="rail-brand" aria-label="옷결 홈"><img src="/brand/logo-lockup.svg" alt="" /></Link>
        {LINKS.map((l) => {
          const active = isActive(pathname, l.to, l.storage)
          return (
            <Link key={l.to} to={l.to} aria-current={active ? 'page' : undefined} className={`rail-link${l.fab ? ' rail-cta' : ''}`}>
              {l.icon}{l.label}{l.storage && badge}
            </Link>
          )
        })}
      </nav>

      <main className={`app-main${hasActionbar ? ' has-actionbar' : ''}`}>
        {/* 알림과 계정(이메일·로그아웃)은 휴대폰·PC 모두 화면 위 오른쪽에 둔다. */}
        <TopBar />
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="주 메뉴">
        {LINKS.map((l) => {
          const active = isActive(pathname, l.to, l.storage)
          return (
            <Link key={l.to} to={l.to} aria-current={active ? 'page' : undefined} className={`tab${l.fab ? ' tab-fab' : ''}`}>
              {l.fab ? <span className="fab-circle">{l.icon}</span> : l.icon}
              <span>{l.label}</span>
              {l.storage && badge}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
