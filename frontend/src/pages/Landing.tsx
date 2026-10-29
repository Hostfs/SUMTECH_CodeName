import { Link } from 'react-router-dom'
import GarmentArt from '../components/GarmentArt'
import { IconPin } from '../components/Icons'
import { useSession } from '../session'

const SAMPLES = [
  { name: '네이비 옥스퍼드 셔츠', sub: 'SHIRT', hex: '#1f2a44', loc: '옷장 A → 왼쪽 행거' },
  { name: '그레이 울 재킷', sub: 'JACKET', hex: '#6b6e70', loc: '옷장 A → 왼쪽 행거' },
  { name: '베이지 니트', sub: 'KNIT', hex: '#d9c8a9', loc: '지금 집에 없어요' },
  { name: '블랙 슬랙스', sub: 'PANTS', hex: '#2a2b30', loc: '서랍장 → 2단' },
]

/** 로그인하지 않은 사람이 처음 보는 화면: 서비스 이름, 하는 일, 시작 방법. */
export default function Landing() {
  const { me } = useSession()
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" className="landing-brand"><img src="/favicon.svg" alt="" />옷결</Link>
        {me ? <Link className="btn btn-sm btn-outline" to="/closet">내 옷장</Link> : <Link className="btn btn-sm btn-outline" to="/login">로그인</Link>}
      </header>

      <section className="landing-hero">
        <div>
          <h1>옷 택 한 장으로,<br />그 옷이 지금 어디 있는지까지</h1>
          <p className="lead">택을 찍어 옷을 등록하고, 입을 조합을 고른 뒤, 어디서 꺼낼지까지 확인하는 내 옷 관리 서비스예요. 세탁소에 맡긴 옷과 돌려받을 날도 함께 챙겨요.</p>
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
            <li><div><strong>택을 찍어 등록</strong><span>AI가 브랜드·소재·세탁법을 읽고, 제품을 찾아 줘요. 읽지 못한 값은 직접 고쳐요.</span></div></li>
            <li><div><strong>입을 조합 고르기</strong><span>내 치수로 만든 3D 모형에 상하의를 입혀 보고, 지금 입을 수 있는 옷으로 추천받아요.</span></div></li>
            <li><div><strong>꺼낼 위치 확인</strong><span>옷장·서랍·박스를 등록하고 배치를 마치면, 검색할 때 위치가 바로 보여요.</span></div></li>
            <li><div><strong>세탁·수선 챙기기</strong><span>맡긴 옷과 회수 예정일을 기록하면 기한이 지난 옷을 알려 줘요.</span></div></li>
          </ol>
        </div>

        <div className="preview" aria-label="내 옷장 화면 미리보기">
          <p className="preview-title">내 옷장 <small style={{ color: 'var(--ink-2)', fontWeight: 400 }}>총 7벌</small></p>
          <div className="grid">
            {SAMPLES.map((s) => (
              <div className="gcard" key={s.name}>
                <div className="gcard-tile"><GarmentArt subType={s.sub} colorHex={s.hex} title={s.name} /></div>
                <div className="gcard-body">
                  <p className="gcard-name">{s.name}</p>
                  <div className="gcard-loc"><IconPin /><span>{s.loc}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="loc-card stitch-in d1">
            <span className="loc-icon"><IconPin /></span>
            <div>
              <div className="loc-label">그레이 울 재킷 보관 위치</div>
              <div className="loc-path">옷장 A → 왼쪽 행거</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
