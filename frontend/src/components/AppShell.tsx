import { Link, Outlet, useLocation } from 'react-router-dom'
import { WeatherProvider } from '../lib/WeatherProvider'
import { useSession } from '../session'
import { Icon, type IconName } from './Icon'
import TopBar from './TopBar'

// 디자인 초안(otgyeol-frontend Layout)의 탭 구성: 홈 · 내 옷장 · (옷 등록) · 코디 · 보관함.
// 보관함은 옷장 지도(/map)·관리함(/care)·옮기기(/move)를 위쪽 탭으로 나눠 담는다.
const STORAGE_PATHS = ['/map', '/care', '/move']
const TABS: { to: string; label: string; icon: IconName; fab?: boolean; storage?: boolean }[] = [
  { to: '/home', label: '홈', icon: 'home' },
  { to: '/closet', label: '내 옷장', icon: 'hanger' },
  { to: '/register', label: '옷 등록', icon: 'plus', fab: true },
  { to: '/outfit', label: '코디', icon: 'shirt' },
  { to: '/map', label: '보관함', icon: 'box', storage: true },
]

function isActive(pathname: string, to: string, storage?: boolean) {
  if (storage) return STORAGE_PATHS.includes(pathname)
  // 옷 상세(/closet/3)도 내 옷장 탭으로 본다.
  return pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * 로그인 후 화면 틀. 휴대폰은 초안 그대로 하단 탭(가운데 옷 등록 버튼, 홈에서는 하늘과 이어짐), PC는 왼쪽 메뉴.
 * 등록 화면은 한 흐름에 집중하도록 하단 탭을 숨긴다(초안과 같다). 메뉴 이름은 두 화면에서 같다.
 */
export default function AppShell() {
  const { careBadge } = useSession()
  const { pathname } = useLocation()
  const onHome = pathname === '/home'
  const focused = pathname === '/register'
  const count = careBadge > 0 ? <b className="tab-count" aria-label={`처리할 관리 ${careBadge}건`}>{careBadge}</b> : null

  return (
    <div className={`app${onHome ? ' on-home' : ' with-float'}`}>
      <nav className="sidenav" aria-label="주 메뉴">
        <Link to="/home" className="sidenav-brand" aria-label="옷결 홈"><img src="/brand/logo-lockup.svg" alt="" /></Link>
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} className={`sidenav-link${t.fab ? ' sidenav-cta' : ''}${isActive(pathname, t.to, t.storage) ? ' active' : ''}`}
            aria-current={isActive(pathname, t.to, t.storage) ? 'page' : undefined}>
            <Icon name={t.icon} size={22} stroke={t.fab ? 2.2 : 1.8} />
            {t.label}
            {t.storage && count}
          </Link>
        ))}
      </nav>

      <WeatherProvider>
        <main className="main">
          {/* 알림 종과 프로필: 홈은 인사 옆에 두고(Home), 다른 화면은 위 오른쪽에 띄운다. */}
          {!onHome && <div className="float-actions"><TopBar /></div>}
          <Outlet />
        </main>
      </WeatherProvider>

      {!focused && (
        <nav className="tabbar" data-blend={onHome} aria-label="주 메뉴">
          {TABS.map((t) => {
            const active = isActive(pathname, t.to, t.storage)
            return (
              <Link key={t.to} to={t.to} className={`tab${t.fab ? ' tab-fab' : ''}${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined} aria-label={t.fab ? t.label : undefined}>
                {t.fab ? (
                  <span className="fab"><Icon name="plus" size={26} stroke={2.2} /></span>
                ) : (
                  <>
                    <Icon name={t.icon} size={24} />
                    <span className="tab-label">{t.label}</span>
                    {t.storage && count}
                  </>
                )}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
