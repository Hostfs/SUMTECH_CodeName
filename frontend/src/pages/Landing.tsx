import { useState } from 'react'
import { Link } from 'react-router-dom'
import GarmentArt from '../components/GarmentArt'
import GuestButton from '../components/GuestButton'
import { Icon, type IconName } from '../components/Icon'
import { Sky } from '../components/SkyScene'
import { useDaylight, sceneFor } from '../lib/daylight'
import { useSession } from '../session'
import '../styles/landing.app.css'

// 예시 옷장(시드 계정과 같은 옷). 로그인 없이 '어디에 있는지' 보기 기준을 눌러 볼 수 있다.
const SAMPLES = [
  { name: '네이비 옥스퍼드 셔츠', sub: 'SHIRT', hex: '#1f2a44', kind: 'HOME', loc: '옷장 A → 왼쪽 행거' },
  { name: '블랙 슬랙스', sub: 'PANTS', hex: '#2a2b30', kind: 'HOME', loc: '서랍장 → 2단' },
  { name: '린넨 반소매 셔츠', sub: 'SHIRT', hex: '#efe8d8', kind: 'BOX', loc: '박스 속 · 여름 박스' },
  { name: '네이비 반바지', sub: 'SHORTS', hex: '#1f2a44', kind: 'BOX', loc: '박스 속 · 여름 박스' },
  { name: '그레이 울 재킷', sub: 'JACKET', hex: '#6b6e70', kind: 'OFFSITE', loc: '집 밖 · 본가' },
  { name: '베이지 니트', sub: 'KNIT', hex: '#d9c8a9', kind: 'CARE', loc: '세탁소 · 어제 회수 예정' },
] as const

const KINDS = [
  { value: 'ALL', label: '전체' },
  { value: 'HOME', label: '집 안' },
  { value: 'BOX', label: '박스 속' },
  { value: 'OFFSITE', label: '집 밖' },
  { value: 'CARE', label: '세탁 맡김' },
] as const

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'box', title: '옮길 때 묶어서 기록', body: '옮길 곳을 고르고 옷을 여러 벌 고르면, 여러 벌이 한 번에 ‘박스 A’·‘세탁소’로 옮겨져요.' },
  { icon: 'pin', title: '어디 있는지 한눈에', body: '내 옷장을 ‘집 밖/박스’로 보면 집 안, 박스 속, 본가, 세탁소에 있는 옷이 나뉘어 보여요.' },
  { icon: 'drop', title: '세탁소 회수 챙기기', body: '맡긴 옷과 회수 예정일을 모아 두고, 기한이 지난 옷을 알려 줘요.' },
  { icon: 'tag', title: '처음 등록은 택 사진으로', body: 'AI가 택의 브랜드·소재·세탁법을 읽어 등록을 도와요. 읽지 못한 값은 직접 고쳐요.' },
]

/**
 * 로그인하지 않은 사람이 처음 보는 화면: 서비스 이름, 하는 일, 시작 방법, 예시 옷장 둘러보기.
 * 디자인 초안의 홈과 같은 짜임이다 — 배경색 위 인사 글자, 그 아래 지금 시각의 하늘과 유리 카드.
 */
export default function Landing() {
  const { me } = useSession()
  const phase = useDaylight()
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('ALL')
  const shown = SAMPLES.filter((s) => kind === 'ALL' || s.kind === kind)

  return (
    <div className="landing">
      <header className="landing-head">
        <Link to="/" className="landing-brand">
          <img className="brand-ink" src="/brand/logo-lockup.svg" alt="옷결" />
          <img className="brand-light" src="/brand/logo-lockup-light.svg" alt="옷결" />
        </Link>
        {me ? <Link className="link-btn" to="/home">내 옷장</Link> : <Link className="link-btn" to="/login">로그인</Link>}
      </header>

      <main className="landing-main">
        <section className="landing-intro">
          <p className="landing-kicker">자취방 옷 위치·상태 기록</p>
          <h1 className="landing-title">
            <span>박스 속, 본가, 세탁소에 둔 옷까지</span>
            <b>지금 어디 있는지 한 번에</b>
          </h1>
          <p className="landing-lead">계절이 바뀌어 박스에 넣거나 본가·세탁소로 보낸 옷은 어디 뒀는지 잊기 쉬워요. 옷결은 옮길 때 여러 벌을 한 번에 기록해 두고, 필요할 때 <em>위치와 상태</em>를 바로 찾게 해 줘요.</p>
          <div className="landing-cta">
            {me ? (
              <Link className="btn btn-primary" to="/home">내 옷장 열기</Link>
            ) : (
              <>
                <Link className="btn btn-primary" to="/signup">시작하기</Link>
                <Link className="btn btn-ghost" to="/login">로그인</Link>
                <GuestButton className="btn btn-ghost" />
              </>
            )}
          </div>
        </section>

        <section className="landing-sky" aria-label="예시 옷장 둘러보기">
          <div className="landing-sky-bg" aria-hidden="true">
            <Sky scene={sceneFor('clear', phase)} />
            <div className="sky-scrim" />
          </div>
          <div className="landing-preview">
            <p className="landing-preview-head">예시 옷장 <small>어디에 있는지로 보기</small></p>
            <div className="chips scroll landing-chips" role="group" aria-label="예시 옷장 보기 기준">
              {KINDS.map((k) => (
                <button key={k.value} type="button" className="chip" data-on={kind === k.value} aria-pressed={kind === k.value} onClick={() => setKind(k.value)}>
                  {k.label}
                </button>
              ))}
            </div>
            <ul className="landing-items">
              {shown.map((s) => (
                <li className="landing-item" key={s.name}>
                  <span className="landing-item-tile"><GarmentArt subType={s.sub} colorHex={s.hex} size={34} /></span>
                  <span className="landing-item-text">
                    <b>{s.name}</b>
                    <small><Icon name="pin" size={11} stroke={2} />{s.loc}</small>
                  </span>
                </li>
              ))}
            </ul>
            <div className="landing-loc">
              <span className="landing-loc-icon"><Icon name="pin" size={22} /></span>
              <div>
                <small>린넨 반소매 셔츠 보관 위치</small>
                <b>여름 박스</b>
                <small>9월 28일에 2벌 함께 옮김</small>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-steps">
          <h2>이렇게 써요</h2>
          <ol>
            {STEPS.map((s) => (
              <li className="landing-step" key={s.title}>
                <span className="landing-step-ico"><Icon name={s.icon} size={22} /></span>
                <b>{s.title}</b>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  )
}
