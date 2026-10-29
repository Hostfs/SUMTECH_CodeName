import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Portrait } from './Portrait';
import { SEASONS, SEASON_SWATCH, type ThemeMode } from '../lib/seasons';
import { SAMPLE_OPTIONS } from '../lib/weather';
import { useTheme } from '../lib/theme';
import { useWeather } from '../lib/WeatherProvider';
import { useToast } from '../lib/toast';
import { useGarments } from '../data/store';
import { statusOf } from '../data/garments';

export const USER = { name: 'CodeName', email: 'student@example.com' };

/** 홈 우측 상단 프로필 사진 + 메뉴 (프로필·알림·앱 테마·로그아웃) */
export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { mode, setMode } = useTheme();
  const { scenario, setScenario, source } = useWeather();
  const { garments } = useGarments();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const managing = garments.filter((g) => ['세탁 중', '수선 중'].includes(statusOf(g))).length;
  const soon = (label: string) => () => {
    setOpen(false);
    toast(`${label}은(는) 다음 단계에서 연결돼요`);
  };

  const row = (icon: IconName, label: string, onClick: () => void, danger = false) => (
    <button className={`pm-item${danger ? ' danger' : ''}`} onClick={onClick} role="menuitem">
      <Icon name={icon} size={19} />
      {label}
      {!danger && <Icon name="chevronRight" size={16} className="pm-chev" />}
    </button>
  );

  return (
    <div className="profile" ref={wrap}>
      <button className="avatar" onClick={() => setOpen((o) => !o)} aria-label="프로필 메뉴" aria-expanded={open} aria-haspopup="menu">
        <span className="avatar-img"><Portrait /></span>
        <i className="avatar-dot" />
      </button>

      {open && (
        <div className="pm" role="menu">
          <div className="pm-me">
            <span className="pm-photo"><Portrait /></span>
            <div>
              <b>{USER.name}</b>
              <small>내 옷 {garments.length}벌 · 관리 중 {managing}벌</small>
            </div>
          </div>
          {row('user', '프로필 수정', soon('프로필 수정'))}
          {row('bell', '알림 설정', soon('알림 설정'))}

          <div className="pm-block">
            <div className="pm-label"><Icon name="palette" size={17} />앱 테마 <span>계절에 따라 색이 바뀌어요</span></div>
            <div className="pm-seg">
              {(['auto', ...SEASONS] as ThemeMode[]).map((m) => (
                <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)} aria-pressed={mode === m}>
                  {m !== 'auto' && <i style={{ background: SEASON_SWATCH[m] }} />}
                  {m === 'auto' ? '자동' : m}
                </button>
              ))}
            </div>
          </div>

          <div className="pm-block">
            <div className="pm-label">
              <Icon name="cloudSun" size={17} />날씨 미리보기
              <span>{source === 'live' ? '실시간 연결됨' : source === 'loading' ? '불러오는 중' : '샘플 표시 중'}</span>
            </div>
            <select className="pm-select" value={scenario} onChange={(e) => setScenario(e.target.value)} aria-label="날씨 미리보기">
              {SAMPLE_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>

          <div className="pm-sep" />
          {row('logout', '로그아웃', () => { setOpen(false); toast('로그아웃은 로그인 화면과 함께 연결돼요'); }, true)}
        </div>
      )}
    </div>
  );
}
