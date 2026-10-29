import { useState } from 'react'
import { Link } from 'react-router-dom'
import GarmentArt from '../components/GarmentArt'
import { IconPin } from '../components/Icons'
import { useSession } from '../session'

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

/** 로그인하지 않은 사람이 처음 보는 화면: 서비스 이름, 하는 일, 시작 방법, 예시 옷장 둘러보기. */
export default function Landing() {
  const { me } = useSession()
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('ALL')
  const shown = SAMPLES.filter((s) => kind === 'ALL' || s.kind === kind)
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" className="landing-brand"><img src="/favicon.svg" alt="" />옷결</Link>
        {me ? <Link className="btn btn-sm btn-outline" to="/closet">내 옷장</Link> : <Link className="btn btn-sm btn-outline" to="/login">로그인</Link>}
      </header>

      <section className="landing-hero">
        <div>
          <h1>박스 속, 본가, 세탁소에 둔 옷까지<br />지금 어디 있는지 한 번에</h1>
          <p className="lead">계절이 바뀌어 박스에 넣거나 본가·세탁소로 보낸 옷은 어디 뒀는지 잊기 쉬워요. 옷결은 옮길 때 여러 벌을 한 번에 기록해 두고, 필요할 때 위치와 상태를 바로 찾게 해 줘요.</p>
          <div className="landing-cta">
            {me ? (
              <Link className="btn" to="/closet">내 옷장 열기</Link>
            ) : (
              <>
                <Link className="btn" to="/signup">시작하기</Link>
                <Link className="btn btn-outline" to="/login">로그인</Link>
              </>
            )}
          </div>
          <ol className="landing-steps">
            <li><div><strong>옮길 때 묶어서 기록</strong><span>박스 라벨 QR이나 세탁소 영수증을 찍고 옷을 고르면, 여러 벌이 한 번에 ‘박스 A’·‘세탁소’로 옮겨져요.</span></div></li>
            <li><div><strong>어디 있는지 한눈에</strong><span>내 옷장을 ‘집 밖/박스’로 보면 집 안, 박스 속, 본가, 세탁소에 있는 옷이 나뉘어 보여요.</span></div></li>
            <li><div><strong>세탁소 회수 챙기기</strong><span>맡긴 옷과 회수 예정일을 모아 두고, 기한이 지난 옷을 알려 줘요.</span></div></li>
            <li><div><strong>처음 등록은 택 사진으로</strong><span>AI가 택의 브랜드·소재·세탁법을 읽어 등록을 도와요. 읽지 못한 값은 직접 고쳐요.</span></div></li>
          </ol>
        </div>

        <div className="preview" aria-label="예시 옷장 둘러보기">
          <p className="preview-title">예시 옷장 <small style={{ color: 'var(--ink-2)', fontWeight: 400 }}>어디에 있는지로 보기</small></p>
          <div className="chips" role="group" aria-label="예시 옷장 보기 기준">
            {KINDS.map((k) => (
              <button key={k.value} type="button" className="chip chip-sm" aria-pressed={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</button>
            ))}
          </div>
          <div className="grid" style={{ marginTop: 12 }}>
            {shown.map((s) => (
              <div className="gcard" key={s.name}>
                <div className="gcard-tile"><GarmentArt subType={s.sub} colorHex={s.hex} title={s.name} /></div>
                <div className="gcard-body">
                  <p className="gcard-name">{s.name}</p>
                  <div className={`gcard-loc${s.kind === 'HOME' ? '' : ' away'}`}><IconPin /><span>{s.loc}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="loc-card stitch-in d1">
            <span className="loc-icon"><IconPin /></span>
            <div>
              <div className="loc-label">린넨 반소매 셔츠 보관 위치</div>
              <div className="loc-path">여름 박스 (9월 28일에 2벌 함께 옮김)</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
