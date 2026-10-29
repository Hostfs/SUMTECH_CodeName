import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { GarmentImage } from '../components/GarmentImage';
import { Precip, Sky } from '../components/Sky';
import { ProfileMenu, USER } from '../components/ProfileMenu';
import { NoticeBell } from '../components/NoticeBell';
import { useGarments } from '../data/store';
import { fmtLoc } from '../data/garments';
import { useTheme } from '../lib/theme';
import { useWeather } from '../lib/WeatherProvider';
import { recommend } from '../lib/recommend';
import { SAMPLES, adviceFor, fmtHour, sceneKey } from '../lib/weather';

const KIND_ICON: Record<string, IconName> = { clear: 'sun', cloudy: 'cloud', rain: 'rain', snow: 'snow' };

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
function today() {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAYS[d.getDay()]}요일`;
}

const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

export default function Home() {
  const { weather, source } = useWeather();
  const { garments } = useGarments();
  const { season } = useTheme();

  const loading = source === 'loading';
  const w = weather ?? SAMPLES['cloudy-day'];
  const advice = adviceFor(w);
  const picks = useMemo(() => recommend(garments, w, season), [garments, w, season]);
  const icon: IconName = w.kind === 'clear' && w.isNight ? 'moon' : KIND_ICON[w.kind];

  let sub: [string, string];
  if (Math.abs(w.feels - w.temp) >= 3) sub = ['체감 온도', `${signed(w.feels)}°`];
  else if (w.diff == null || w.diff === 0) sub = ['어제와', '비슷해요'];
  else sub = ['어제보다', `${Math.abs(w.diff)}° ${w.diff < 0 ? '낮아요' : '높아요'}`];

  return (
    <div className={`home${loading ? ' is-loading' : ''}`}>
      <header className="home-head">
        <div>
          <p className="home-date">{today()}</p>
          <p className="home-hello">안녕하세요,</p>
          <h1 className="home-name">{USER.name}<span>님</span></h1>
        </div>
        <div className="head-actions">
          <NoticeBell />
          <ProfileMenu />
        </div>
      </header>

      <div className="home-sky" key={sceneKey(w)}>
        <Sky scene={sceneKey(w)} />
        <Precip kind={w.kind} />
        <div className="sky-scrim" />
      </div>
      <div className="home-fade-top" />

      <section className="wx" aria-label="오늘의 날씨">
        <p className="wx-loc"><Icon name="pin" size={14} />{w.place}</p>
        <p className="wx-cond"><Icon name={icon} size={18} />{loading ? '날씨를 불러오고 있어요' : w.label}</p>

        <div className="wx-main">
          <div className="wx-temp" aria-label={`현재 기온 ${w.temp}도`}>
            {w.temp < 0 && <span className="neg">−</span>}
            {Math.abs(w.temp)}
            <sup>°</sup>
          </div>
          <p className="wx-sub">{sub[0]}<b>{sub[1]}</b></p>
        </div>

        <dl className="wx-stats">
          <div>
            <dt>최고 <b>{signed(w.hi.v)}°</b></dt>
            <dd>{fmtHour(w.hi.h)}</dd>
          </div>
          <div>
            <dt>최저 <b>{signed(w.lo.v)}°</b></dt>
            <dd>{fmtHour(w.lo.h)}</dd>
          </div>
          <div>
            <dt><Icon name="drop" size={13} stroke={2} /> 강수확률</dt>
            <dd className="big">{w.pop}%</dd>
          </div>
        </dl>

        <div className="advice">
          <p className="advice-eyebrow"><Icon name="sparkle" size={13} />옷결의 한마디</p>
          <p className="advice-text">
            {advice.line1}
            <br />
            {advice.before}<em>{advice.key}</em>{advice.after}
          </p>
        </div>

        {picks.length > 0 && (
          <div className="recs">
            <div className="recs-head">
              <span>옷장에서 바로 꺼내기</span>
              <Link to="/closet">전체 보기 ›</Link>
            </div>
            <div className="recs-row">
              {picks.map((g) => (
                <Link key={g.id} to={`/closet/${g.id}`} className="rec">
                  <span className="rec-tile"><GarmentImage g={g} size={34} /></span>
                  <span className="rec-text">
                    <b>{g.name}</b>
                    <small><Icon name="pin" size={11} stroke={2} />{fmtLoc(g.loc)}</small>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
