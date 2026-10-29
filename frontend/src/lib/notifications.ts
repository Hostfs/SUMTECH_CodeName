import { dueLabel, isOverdue, isoDay, type Garment } from '../data/garments';
import type { IconName } from '../components/Icon';
import type { Weather } from './weather';
import { eul } from './josa';

export interface Notice {
  /** 같은 일이 다시 생기지 않는 한 같은 id (날짜 포함) — 읽음·삭제 기록의 열쇠 */
  id: string;
  icon: IconName;
  tone: 'alert' | 'care' | 'weather' | 'info';
  title: string;
  body: string;
  to: string;
}

/**
 * 알림은 서버 푸시가 아니라 지금 앱이 가진 기록에서 계산한다 (계획서 14장: 닫힌 동안의 푸시는 범위 밖).
 * 앱을 열 때마다 세탁·수선 기한, 미배치, 날씨 변화를 다시 읽는다.
 */
export function buildNotices(garments: Garment[], weather: Weather | null): Notice[] {
  const today = isoDay(0);
  const out: Notice[] = [];

  for (const g of garments.filter(isOverdue)) {
    out.push({
      id: `late-${g.id}-${g.care!.due}`,
      icon: 'alert',
      tone: 'alert',
      title: `${g.name} 회수 기한이 지났어요`,
      body: `${g.care!.kind}을 맡긴 ${g.care!.vendor ?? g.care!.place}에서 찾아오세요 · ${dueLabel(g.care!.due)}`,
      to: `/closet/${g.id}`,
    });
  }
  for (const g of garments.filter((x) => x.care && x.care.due === today)) {
    out.push({
      id: `today-${g.id}-${today}`,
      icon: g.care!.kind === '세탁' ? 'drop' : 'scissors',
      tone: 'care',
      title: `오늘 ${eul(g.name)} 찾는 날이에요`,
      body: `${g.care!.vendor ?? g.care!.place} · ${g.care!.kind} 회수 예정`,
      to: `/closet/${g.id}`,
    });
  }

  const unplaced = garments.filter((g) => !g.loc);
  if (unplaced.length) {
    out.push({
      id: `unplaced-${unplaced.map((g) => g.id).join(',')}`,
      icon: 'pin',
      tone: 'info',
      title: `보관 위치가 없는 옷이 ${unplaced.length}벌 있어요`,
      body: `${unplaced[0].name}${unplaced.length > 1 ? ` 외 ${unplaced.length - 1}벌` : ''} · 보관함에서 배치 추천을 받아 보세요`,
      to: '/storage',
    });
  }

  if (weather) {
    if (weather.kind === 'rain' || weather.pop >= 60) {
      out.push({
        id: `rain-${today}`,
        icon: 'rain',
        tone: 'weather',
        title: `오늘 비 올 확률 ${weather.pop}%`,
        body: '우산과 방수되는 겉옷을 챙기세요',
        to: '/',
      });
    }
    if (weather.kind === 'snow' || weather.temp <= 0) {
      out.push({
        id: `cold-${today}`,
        icon: 'snow',
        tone: 'weather',
        title: `지금 ${weather.temp}°로 영하예요`,
        body: '패딩이나 롱코트를 꺼내 두세요',
        to: '/closet',
      });
    }
    const swing = weather.hi.v - weather.lo.v;
    if (swing >= 10) {
      out.push({
        id: `swing-${today}`,
        icon: 'cloudSun',
        tone: 'weather',
        title: `오늘 기온 차가 ${swing}°예요`,
        body: '벗기 쉬운 겉옷을 겹쳐 입으면 좋아요',
        to: '/outfit',
      });
    }
  }
  return out;
}
