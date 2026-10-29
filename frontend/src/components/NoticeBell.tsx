import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { useGarments } from '../data/store';
import { useWeather } from '../lib/WeatherProvider';
import { buildNotices } from '../lib/notifications';
import { load, save } from '../lib/storage';

interface Seen {
  read: string[];
  gone: string[];
}
const KEY = 'ot.notices.v1';

/** 홈 우측 상단 알림 종 + 알림 목록 시트. 읽음·지움 표시는 이 기기에만 저장한다. */
export function NoticeBell() {
  const { garments } = useGarments();
  const { weather } = useWeather();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Seen>(() => load<Seen>(KEY, { read: [], gone: [] }));

  const notices = useMemo(
    () => buildNotices(garments, weather).filter((n) => !seen.gone.includes(n.id)),
    [garments, weather, seen.gone],
  );
  const unread = notices.filter((n) => !seen.read.includes(n.id));

  const update = (next: Seen) => {
    setSeen(next);
    save(KEY, next);
  };
  const markRead = (ids: string[]) => update({ ...seen, read: Array.from(new Set([...seen.read, ...ids])) });

  return (
    <>
      <button className="bell" onClick={() => setOpen(true)} aria-label={unread.length ? `알림 ${unread.length}건` : '알림'}>
        <Icon name="bell" size={22} />
        {unread.length > 0 && <b className="bell-badge">{unread.length}</b>}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="알림">
        {notices.length > 0 && (
          <div className="notice-top">
            <span>{unread.length ? `새 알림 ${unread.length}건` : '모두 읽었어요'}</span>
            <button className="btn-text" disabled={unread.length === 0} onClick={() => markRead(notices.map((n) => n.id))}>모두 읽음</button>
          </div>
        )}
        {notices.length === 0 ? (
          <div className="empty">
            <p className="empty-title">새 알림이 없어요</p>
            <p>세탁·수선 회수일이나 날씨가 바뀌면 여기에 알려 드려요.</p>
          </div>
        ) : (
          <ul className="notice-list">
            {notices.map((n) => {
              const isNew = !seen.read.includes(n.id);
              return (
                <li key={n.id} className={`nt nt-${n.tone}`} data-new={isNew}>
                  <button
                    className="nt-main"
                    onClick={() => { markRead([n.id]); setOpen(false); nav(n.to); }}
                  >
                    <span className="nt-ico"><Icon name={n.icon} size={19} /></span>
                    <span className="nt-text">
                      <b>{n.title}</b>
                      <small>{n.body}</small>
                    </span>
                    {isNew && <i className="nt-dot" aria-label="읽지 않음" />}
                  </button>
                  <button className="icon-btn nt-x" onClick={() => update({ ...seen, gone: [...seen.gone, n.id] })} aria-label={`${n.title} 지우기`}>
                    <Icon name="close" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="fine">앱이 가진 기록(세탁·수선, 보관 위치, 날씨)을 열 때마다 읽어 만든 알림이에요. 앱을 닫아 둔 동안의 푸시 알림은 아직 없어요.</p>
      </Sheet>
    </>
  );
}
