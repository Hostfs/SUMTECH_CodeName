export type SkyKind = 'clear' | 'cloudy' | 'rain' | 'snow';

export interface Weather {
  place: string;
  kind: SkyKind;
  label: string;
  temp: number;
  feels: number;
  /** 어제 같은 시각 대비 기온 차 */
  diff: number | null;
  hi: { v: number; h: number };
  lo: { v: number; h: number };
  /** 오늘 강수확률 최대값 (%) */
  pop: number;
  isNight: boolean;
}

// 위치는 우선 고정값: 광주창조경제혁신센터 (광주 서구 경열로17번길 12, 농성동).
// 주소는 공공데이터 기반 기업정보 사이트 기준이고, 좌표는 OpenStreetMap 에서 그 도로명으로 찾은 값이다.
// 휴대폰에서는 navigator.geolocation 으로 바꿔 끼우면 된다.
export const PLACE = { name: '전남광주통합특별시 · 광주창조경제혁신센터', lat: 35.1534, lon: 126.8901 };

export const sceneKey = (w: Pick<Weather, 'kind' | 'isNight'>) => `${w.kind}-${w.isNight ? 'night' : 'day'}`;

export function fmtHour(h: number): string {
  const ap = h < 12 ? '오전' : '오후';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${hh}시`;
}

// ---- 실시간 날씨: Open-Meteo (API 키 없음) -------------------------------------------------
function mapCode(code: number): [SkyKind, string] {
  if (code === 0) return ['clear', '맑음'];
  if (code <= 2) return ['clear', '구름 조금'];
  if (code === 3) return ['cloudy', '흐림'];
  if (code === 45 || code === 48) return ['cloudy', '안개'];
  if (code >= 51 && code <= 57) return ['rain', '이슬비'];
  if (code >= 61 && code <= 67) return ['rain', '비'];
  if (code >= 71 && code <= 77) return ['snow', '눈'];
  if (code >= 80 && code <= 82) return ['rain', '소나기'];
  if (code === 85 || code === 86) return ['snow', '눈'];
  if (code >= 95) return ['rain', '천둥번개'];
  return ['cloudy', '흐림'];
}

interface OpenMeteo {
  current: { time: string; temperature_2m: number; apparent_temperature: number; weather_code: number; is_day: number };
  hourly: { temperature_2m: number[] };
  daily: { precipitation_probability_max: (number | null)[] };
}

export async function fetchWeather(signal?: AbortSignal): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,is_day` +
    `&hourly=temperature_2m&daily=precipitation_probability_max` +
    `&timezone=Asia%2FSeoul&past_days=1&forecast_days=1`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const d = (await res.json()) as OpenMeteo;

  // 시간별 배열은 어제 24칸 + 오늘 24칸
  const today = d.hourly.temperature_2m.slice(24, 48);
  const nowHour = Number(d.current.time.slice(11, 13));
  let hi = 0;
  let lo = 0;
  today.forEach((v, h) => {
    if (v > today[hi]) hi = h;
    if (v < today[lo]) lo = h;
  });
  const [kind, label] = mapCode(d.current.weather_code);
  const yesterday = d.hourly.temperature_2m[24 + nowHour - 24];

  return {
    place: PLACE.name,
    kind,
    label,
    temp: Math.round(d.current.temperature_2m),
    feels: Math.round(d.current.apparent_temperature),
    diff: yesterday == null ? null : Math.round(d.current.temperature_2m) - Math.round(yesterday),
    hi: { v: Math.round(today[hi]), h: hi },
    lo: { v: Math.round(today[lo]), h: lo },
    pop: d.daily.precipitation_probability_max[1] ?? 0,
    isNight: d.current.is_day === 0,
  };
}

// ---- 샘플 날씨 (오프라인·미리보기용) ---------------------------------------------------------
const s = (w: Omit<Weather, 'place'>): Weather => ({ place: PLACE.name, ...w });

export const SAMPLES: Record<string, Weather> = {
  'clear-day': s({ kind: 'clear', label: '맑음', temp: 9, feels: 7, diff: -3, hi: { v: 17, h: 14 }, lo: { v: 6, h: 5 }, pop: 10, isNight: false }),
  'clear-night': s({ kind: 'clear', label: '맑은 저녁', temp: 11, feels: 10, diff: -1, hi: { v: 18, h: 14 }, lo: { v: 9, h: 6 }, pop: 20, isNight: true }),
  'cloudy-day': s({ kind: 'cloudy', label: '흐림', temp: 14, feels: 13, diff: 1, hi: { v: 16, h: 13 }, lo: { v: 7, h: 6 }, pop: 30, isNight: false }),
  'cloudy-night': s({ kind: 'cloudy', label: '흐린 밤', temp: 13, feels: 12, diff: 0, hi: { v: 16, h: 13 }, lo: { v: 8, h: 5 }, pop: 30, isNight: true }),
  'rain-day': s({ kind: 'rain', label: '비', temp: 15, feels: 14, diff: -2, hi: { v: 17, h: 13 }, lo: { v: 12, h: 6 }, pop: 80, isNight: false }),
  'rain-night': s({ kind: 'rain', label: '비', temp: 12, feels: 11, diff: -3, hi: { v: 15, h: 13 }, lo: { v: 10, h: 4 }, pop: 90, isNight: true }),
  'snow-day': s({ kind: 'snow', label: '눈', temp: -1, feels: -6, diff: -4, hi: { v: 2, h: 14 }, lo: { v: -7, h: 6 }, pop: 70, isNight: false }),
  'snow-night': s({ kind: 'snow', label: '눈', temp: -3, feels: -8, diff: -2, hi: { v: 1, h: 13 }, lo: { v: -7, h: 6 }, pop: 70, isNight: true }),
};

export const SAMPLE_OPTIONS: [string, string][] = [
  ['live', '실시간'],
  ['clear-day', '맑음 · 낮'],
  ['clear-night', '맑음 · 저녁'],
  ['cloudy-day', '흐림'],
  ['rain-night', '비 · 밤'],
  ['snow-night', '눈 · 저녁'],
  ['snow-day', '눈 · 낮'],
];

export function sampleForNow(): Weather {
  const h = new Date().getHours();
  return SAMPLES[h >= 19 || h < 6 ? 'clear-night' : 'clear-day'];
}

// ---- 옷차림 한마디 ----------------------------------------------------------------------
export interface Advice {
  line1: string;
  before: string;
  key: string;
  after: string;
}

export function adviceFor(w: Weather): Advice {
  const t = w.temp;
  const swing = w.hi.v - w.lo.v;

  if (w.kind === 'snow') {
    return t <= 2
      ? { line1: '눈이 내리고 영하로 떨어졌어요.', before: '', key: '패딩과 목도리', after: '까지 꼭 챙기세요.' }
      : { line1: '눈이 내리고 있어요.', before: '', key: '방수되는 신발', after: '을 신어 보세요.' };
  }
  if (w.kind === 'rain' || w.pop >= 60) {
    return {
      line1: w.kind === 'rain' ? '지금 비가 내리고 있어요.' : `오늘 비 올 확률이 ${w.pop}%예요.`,
      before: '',
      key: t <= 10 ? '따뜻한 방수 겉옷' : '우산과 가벼운 겉옷',
      after: '을 챙겨 보세요.',
    };
  }
  if (swing >= 10 && t >= 14 && t <= 22) {
    return { line1: `하루 기온 차가 ${swing}°로 커요.`, before: '', key: '벗기 쉬운 겉옷', after: '을 챙겨 보세요.' };
  }
  if (t <= 5) return { line1: '오늘은 꽤 추워요.', before: '', key: '패딩이나 롱코트', after: '로 단단히 입으세요.' };
  if (t <= 9) return { line1: '오늘은 날씨가 쌀쌀하니', before: '', key: '두꺼운 겉옷', after: '을 입는 건 어떨까요?' };
  if (t <= 13) return { line1: '아침저녁으로 쌀쌀해요.', before: '', key: '도톰한 겉옷', after: '을 챙겨 볼까요?' };
  if (t <= 17) return { line1: '선선한 날씨예요.', before: '', key: '얇은 겉옷', after: ' 하나면 충분해요.' };
  if (t <= 22) return { line1: '포근한 날씨예요.', before: '', key: '긴팔 한 장', after: '이면 딱 좋아요.' };
  if (t <= 27) return { line1: '따뜻한 날씨예요.', before: '', key: '가벼운 반팔', after: '을 입어 보세요.' };
  return { line1: '꽤 더워요.', before: '', key: '시원한 린넨 소재', after: '로 입어 보세요.' };
}
