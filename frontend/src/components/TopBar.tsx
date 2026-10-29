import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { formatDate } from '../format'
import { PHASE_LABEL, previewPhase, setPreviewPhase, type Phase } from '../lib/daylight'
import { SEASON_LABEL, SEASON_SWATCH, setThemeMode, themeMode, type ThemeMode } from '../lib/season'
import { displayName, isGuest, useSession } from '../session'
import type { Board, GarmentSummary } from '../types'
import { Icon, type IconName } from './Icon'
import { Portrait } from './Portrait'
import { Sheet } from './Ui'

type Notice = { key: string; tone: 'alert' | 'care' | 'place'; icon: IconName; title: string; body: string; to: string; isNew: boolean }

/** 알림: 관리함의 기한 지남·오늘 회수, 위치가 없는 옷, 돌려받고 자리를 확인할 옷. 열 때마다 새로 읽는다. */
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
            key: `o${i.care.id}`, tone: 'alert' as const, icon: 'alert' as const, isNew: true,
            title: `${i.garment.name} 회수 기한이 지났어요`,
            body: `${i.care.shopName ?? i.care.placeLabel} · ${formatDate(i.care.dueOn)} 회수 예정이었어요`, to: '/care',
          })),
          ...board.dueToday.map((i) => ({
            key: `t${i.care.id}`, tone: 'care' as const, icon: 'drop' as const, isNew: true,
            title: `오늘 ${i.garment.name}을(를) 찾아오세요`,
            body: `${i.care.shopName ?? i.care.placeLabel} · ${i.care.careTypeLabel}`, to: '/care',
          })),
        ]
        const unplaced = garments.filter((g) => g.locationKind === 'UNPLACED' && g.status !== 'RETURNED_UNPLACED')
        if (unplaced.length) {
          list.push({
            key: 'u', tone: 'place', icon: 'pin', isNew: false, title: `위치가 없는 옷 ${unplaced.length}벌`,
            body: `${unplaced[0].name}${unplaced.length > 1 ? ` 외 ${unplaced.length - 1}벌` : ''} · 옷장 지도에서 넣을 곳을 정해요`, to: '/map',
          })
        }
        const returned = garments.filter((g) => g.status === 'RETURNED_UNPLACED')
        if (returned.length) {
          list.push({
            key: 'r', tone: 'care', icon: 'hanger', isNew: true, title: `돌려받은 옷 ${returned.length}벌의 자리를 확인하세요`,
            body: `${returned[0].name} · 옷 정보에서 ‘재배치 확인’`, to: `/closet/${returned[0].id}`,
          })
        }
        setItems(list)
      })
      .catch(() => alive && setItems([]))
    return () => { alive = false }
  }, [open])
  return items
}

/** 알림 종 + 알림 목록 시트(디자인 초안 NoticeBell). */
function NoticeBell() {
  const { careBadge } = useSession()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const notices = useNotices(open)
  const fresh = notices?.filter((n) => n.isNew).length ?? careBadge

  return (
    <>
      <button type="button" className="bell" onClick={() => setOpen(true)} aria-label={careBadge ? `알림 ${careBadge}건` : '알림'}>
        <Icon name="bell" size={22} />
        {careBadge > 0 && <b className="bell-badge">{careBadge}</b>}
      </button>
      {open && (
        <Sheet title="알림" onClose={() => setOpen(false)}>
          {notices === null ? (
            <p className="sheet-text">불러오는 중…</p>
          ) : notices.length === 0 ? (
            <div className="empty">
              <p className="empty-title">새 알림이 없어요</p>
              <p>세탁·수선 회수일이 오거나 위치가 비어 있는 옷이 생기면 여기에 알려 드려요.</p>
            </div>
          ) : (
            <>
              <div className="notice-top"><span>{fresh ? `챙길 일 ${fresh}건` : '모두 확인했어요'}</span></div>
              <ul className="notice-list">
                {notices.map((n) => (
                  <li key={n.key} className={`nt nt-${n.tone === 'alert' ? 'alert' : 'info'}`} data-new={n.isNew}>
                    <button type="button" className="nt-main" onClick={() => { setOpen(false); nav(n.to) }}>
                      <span className="nt-ico"><Icon name={n.icon} size={19} /></span>
                      <span className="nt-text"><b>{n.title}</b><small>{n.body}</small></span>
                      {n.isNew && <i className="nt-dot" aria-label="챙길 일" />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="fine">앱을 열 때마다 관리함·옷 위치 기록을 읽어 만든 알림이에요. 앱을 닫아 둔 동안의 푸시 알림은 없어요(회수일은 관리함의 ‘달력에 넣기’로 휴대폰 달력에 넣을 수 있어요).</p>
        </Sheet>
      )}
    </>
  )
}

const PREVIEWS: [string, Phase | null][] = [['실시간', null], ['새벽', 'dawn'], ['낮', 'day'], ['노을', 'dusk'], ['밤', 'night']]

/** 프로필 사진 + 메뉴(디자인 초안 ProfileMenu): 내 정보, 앱 테마, 하늘 미리보기, 로그아웃. */
function ProfileMenu() {
  const { me, logout } = useSession()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ThemeMode>(themeMode)
  const [preview, setPreview] = useState<Phase | null>(previewPhase)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const name = isGuest(me) ? '게스트' : (me?.email ?? '').split('@')[0]

  return (
    <div className="profile" ref={wrap}>
      <button type="button" className="avatar" onClick={() => setOpen((o) => !o)} aria-label="프로필 메뉴" aria-expanded={open} aria-haspopup="menu">
        <span className="avatar-img"><Portrait /></span>
        <i className="avatar-dot" />
      </button>

      {open && (
        <div className="pm" role="menu">
          <div className="pm-me">
            <span className="pm-photo"><Portrait /></span>
            <div>
              <b>{name}</b>
              <small>{isGuest(me) ? '게스트 체험 중' : displayName(me)}</small>
            </div>
          </div>

          <div className="pm-block">
            <div className="pm-label"><Icon name="palette" size={17} />앱 테마 <span>계절에 따라 색이 바뀌어요</span></div>
            <div className="pm-seg">
              {(['auto', 'spring', 'summer', 'autumn', 'winter'] as ThemeMode[]).map((m) => (
                <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m}
                  onClick={() => { setMode(m); setThemeMode(m) }}>
                  {m !== 'auto' && <i style={{ background: SEASON_SWATCH[m] }} />}
                  {m === 'auto' ? '자동' : SEASON_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="pm-block">
            <div className="pm-label">
              <Icon name="cloudSun" size={17} />하늘 미리보기
              <span>{preview ? `${PHASE_LABEL[preview]} 보는 중` : '지금 시각'}</span>
            </div>
            <select className="pm-select" aria-label="하늘 미리보기" value={preview ?? ''}
              onChange={(e) => { const p = (e.target.value || null) as Phase | null; setPreview(p); setPreviewPhase(p) }}>
              {PREVIEWS.map(([label, p]) => <option key={label} value={p ?? ''}>{label}</option>)}
            </select>
          </div>

          <div className="pm-sep" />
          <button type="button" className="pm-item danger" role="menuitem" onClick={() => { setOpen(false); void logout() }}>
            <Icon name="logout" size={19} />로그아웃
          </button>
        </div>
      )}
    </div>
  )
}

/** 화면 위 오른쪽: 알림 종 + 프로필. 홈은 인사 옆에, 다른 화면은 제목 줄 오른쪽에 둔다. */
export default function TopBar() {
  return (
    <div className="head-actions">
      <NoticeBell />
      <ProfileMenu />
    </div>
  )
}
