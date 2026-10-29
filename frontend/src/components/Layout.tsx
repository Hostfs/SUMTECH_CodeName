import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { useWeather } from '../lib/WeatherProvider';
import { sampleForNow } from '../lib/weather';

// 메뉴 이름은 한곳에서만 정의한다 (E2E 선택자와 계획서의 메뉴 이름을 맞출 때 여기만 고치면 된다).
const TABS: { to: string; label: string; icon: IconName; end?: boolean; fab?: boolean }[] = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/closet', label: '내 옷장', icon: 'hanger' },
  { to: '/register', label: '옷 등록', icon: 'plus', fab: true },
  { to: '/outfit', label: '코디', icon: 'shirt' },
  { to: '/storage', label: '보관함', icon: 'box' },
];

export default function Layout() {
  const { pathname } = useLocation();
  const { weather } = useWeather();
  const onHome = pathname === '/';
  // 상세·등록은 하나의 흐름에 집중하도록 하단 탭을 숨긴다 (시안과 동일).
  const focused = pathname.startsWith('/closet/') || pathname === '/register';
  // 밤에는 홈만이 아니라 앱 전체가 어두운 톤이다 (화면을 오갈 때 밝기가 튀지 않게). 날씨가 오기 전에는 시각으로 가늠한다.
  const dark = (weather ?? sampleForNow()).isNight;

  useEffect(() => {
    document.documentElement.dataset.tone = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(() => {
    document.getElementById('screen')?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <div className="screen" id="screen">
        <main className="main">
          <Outlet />
        </main>
        {!focused && (
          <nav className="tabbar" data-blend={onHome} aria-label="주 메뉴">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${t.fab ? ' tab-fab' : ''}${isActive ? ' active' : ''}`}>
                {t.fab ? (
                  <span className="fab" aria-label={t.label}><Icon name="plus" size={26} stroke={2.2} /></span>
                ) : (
                  <>
                    <Icon name={t.icon} size={24} />
                    <span className="tab-label">{t.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}
      </div>

      {/* PC 브라우저에서만 보이는 아이폰 상단·하단 장식 (실제 폰에서는 숨김) */}
      <div className="chrome" aria-hidden="true">
        <div className="chrome-status">
          <span>9:41</span>
          <span className="island" />
          <span className="chrome-icons">
            <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
            <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.6" y="0.6" width="22.8" height="11.8" rx="3.6" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.2" /><rect x="2.4" y="2.4" width="17" height="8.2" rx="2" fill="currentColor" /><path d="M25 4.5v4c.9-.3 1.4-1.1 1.4-2s-.5-1.7-1.4-2Z" fill="currentColor" fillOpacity=".5" /></svg>
          </span>
        </div>
        <div className="chrome-home" />
      </div>
    </>
  );
}
