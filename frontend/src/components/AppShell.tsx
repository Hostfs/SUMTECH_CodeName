import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../session'
import { IconBox, IconHanger, IconMap, IconMove, IconPlus } from './Icons'
import TopBar from './TopBar'

// 수정안(2026-10-29)에서 3D 코디·추천(R05·R06)을 범위에서 빼고 옮기기(R11)를 넣었다.
const LINKS = [
  { to: '/closet', label: '내 옷장', icon: <IconHanger /> },
  { to: '/map', label: '옷장 지도', icon: <IconMap /> },
  { to: '/register', label: '옷 등록', icon: <IconPlus />, fab: true },
  { to: '/move', label: '옮기기', icon: <IconMove /> },
  { to: '/care', label: '관리함', icon: <IconBox /> },
]

/** 로그인 후 화면 틀. 휴대폰은 하단 탭(가운데 옷 등록 버튼), PC는 왼쪽 메뉴. 메뉴 이름은 두 화면에서 같다. */
export default function AppShell() {
  const { careBadge } = useSession()
  const { pathname } = useLocation()
  const hasActionbar = /^\/closet\/\d+/.test(pathname)
  const badge = careBadge > 0 ? <span className="badge" aria-label={`처리할 관리 ${careBadge}건`}>{careBadge}</span> : null

  return (
    <div className="app with-nav">
      <nav className="rail" aria-label="주 메뉴">
        <NavLink to="/closet" className="rail-brand"><img src="/favicon.svg" alt="" />옷결</NavLink>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className={`rail-link${l.fab ? ' rail-cta' : ''}`}>
            {l.icon}{l.label}{l.to === '/care' && badge}
          </NavLink>
        ))}
      </nav>

      <main className={`app-main${hasActionbar ? ' has-actionbar' : ''}`}>
        {/* 알림과 계정(이메일·로그아웃)은 휴대폰·PC 모두 화면 위 오른쪽에 둔다. */}
        <TopBar />
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="주 메뉴">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className={`tab${l.fab ? ' tab-fab' : ''}`}>
            {l.fab ? <span className="fab-circle">{l.icon}</span> : l.icon}
            <span>{l.label}</span>
            {l.to === '/care' && badge}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
