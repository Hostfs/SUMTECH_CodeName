import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import GuestButton from '../components/GuestButton'
import { Icon } from '../components/Icon'
import { IconEye, IconEyeOff } from '../components/Icons'
import { Sky } from '../components/SkyScene'
import { Notice, Spinner } from '../components/Ui'
import { useDaylight, sceneFor } from '../lib/daylight'
import { useSession } from '../session'
import '../styles/auth.app.css'

type Mode = 'login' | 'signup'

const MIN_PASSWORD = 8

/**
 * 로그인·회원가입. 디자인 초안에는 이 화면이 없어 초안의 하늘·로고·버튼·입력 칸과 글자 크기만으로 만들었다.
 * 휴대폰: 화면 가득 지금 시각의 하늘, 위에 로고와 한 줄 소개, 아래에서 올라온 흰 시트에 입력 칸과 엄지 닿는 버튼.
 * PC: 왼쪽 하늘 위 서비스 소개, 오른쪽 입력.
 */
function AuthForm({ mode }: { mode: Mode }) {
  const { setMe } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const phase = useDaylight()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isSignup = mode === 'signup'
  const longEnough = password.length >= MIN_PASSWORD

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const me = await api.post<{ id: number; email: string }>(isSignup ? '/api/auth/signup' : '/api/auth/login', { email, password })
      setMe(me)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' && from !== '/signup' ? from : '/home', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-sky" aria-hidden="true">
        <Sky scene={sceneFor('clear', phase)} />
        <div className="sky-scrim" />
      </div>

      {/* PC: 왼쪽 하늘 위 서비스 소개 */}
      <aside className="auth-hero">
        <Link to="/" className="auth-logo"><img src="/brand/logo-lockup-light.svg" alt="옷결" /></Link>
        <div className="auth-hero-copy">
          <p className="auth-kicker">자취방 옷 위치·상태 기록</p>
          <p className="auth-hero-title"><span>박스·본가·세탁소로 옮긴 옷,</span><b>열어 보지 않고 찾아요.</b></p>
        </div>
        <ul className="auth-points">
          <li><span className="auth-point-icon"><Icon name="box" size={22} /></span>박스·본가·세탁소로 옮길 때 여러 벌을 골라 한 번에 기록해요.</li>
          <li><span className="auth-point-icon"><Icon name="pin" size={22} /></span>본가·박스에 둔 옷도 ‘여름 박스’처럼 위치로 바로 보여요.</li>
          <li><span className="auth-point-icon"><Icon name="drop" size={22} /></span>세탁소에 맡긴 옷은 회수 예정일까지 챙겨 드려요.</li>
        </ul>
      </aside>

      <main className="auth-main">
        {/* 휴대폰: 하늘 위 로고와 한 줄 소개 */}
        <div className="auth-top">
          <Link to="/" className="auth-logo"><img src="/brand/logo-lockup-light.svg" alt="옷결" /></Link>
          <p className="auth-tagline"><span>박스·본가·세탁소에 둔 옷까지</span><b>어디 있는지 한 번에</b></p>
        </div>

        <form className="auth-sheet" onSubmit={submit} noValidate>
          <div className="auth-intro">
            <h1>{isSignup ? '내 옷장을 만들어요' : '다시 오셨네요'}</h1>
            <p>{isSignup ? '이메일과 비밀번호만 있으면 바로 시작해요.' : '이메일로 로그인하고 내 옷장으로 돌아가요.'}</p>
          </div>

          <div className="fields">
            <div className="field">
              <label htmlFor="email">이메일</label>
              <input id="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none"
                placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="password">비밀번호</label>
              <div className="pw-wrap">
                <input id="password" type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isSignup ? MIN_PASSWORD : undefined} />
                <button type="button" className="icon-btn pw-toggle" aria-pressed={showPassword} aria-label={showPassword ? '입력한 글자 숨기기' : '입력한 글자 보기'}
                  onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              {isSignup && (
                <span className={`pw-rule${longEnough ? ' ok' : ''}`}><Icon name="check" size={14} stroke={2.2} />{MIN_PASSWORD}자 이상</span>
              )}
            </div>
            {error && <Notice>{error}</Notice>}
          </div>

          <div className="auth-actions">
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy && <Spinner />}{isSignup ? '가입하기' : '로그인'}
            </button>
            <p className="auth-switch">
              {isSignup ? <>이미 계정이 있나요? <Link to="/login">로그인</Link></> : <>처음이세요? <Link to="/signup">회원가입</Link></>}
            </p>
            <div className="auth-guest"><GuestButton /></div>
          </div>
        </form>
      </main>
    </div>
  )
}

export const Login = () => <AuthForm mode="login" />
export const Signup = () => <AuthForm mode="signup" />
