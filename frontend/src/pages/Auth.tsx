import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { IconBox, IconCheck, IconEye, IconEyeOff, IconPin, IconWash } from '../components/Icons'
import { Notice, Spinner } from '../components/Ui'
import { useSession } from '../session'

type Mode = 'login' | 'signup'

const MIN_PASSWORD = 8

/**
 * 로그인·회원가입. PC는 왼쪽에 서비스 소개, 오른쪽에 입력 칸을 둔다.
 * 휴대폰은 입력 칸만 크게 두고 버튼을 화면 아래(엄지 닿는 곳)에 붙인다.
 */
function AuthForm({ mode }: { mode: Mode }) {
  const { setMe } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
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
      navigate(from && from !== '/login' ? from : '/closet', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <aside className="auth-hero">
        <Link to="/" className="landing-brand"><img src="/favicon.svg" alt="" />옷결</Link>
        <div>
          <p className="auth-hero-title">박스·본가·세탁소로 옮긴 옷,<br />열어 보지 않고 찾아요.</p>
          <ul className="auth-points">
            <li><span className="auth-point-icon"><IconBox /></span>박스에 넣을 때 라벨 QR을 찍고 여러 벌을 한 번에 기록해요.</li>
            <li><span className="auth-point-icon"><IconPin /></span>본가·박스에 둔 옷도 ‘여름 박스’처럼 위치로 바로 보여요.</li>
            <li><span className="auth-point-icon"><IconWash /></span>세탁소에 맡긴 옷은 회수 예정일까지 챙겨 드려요.</li>
          </ul>
        </div>
        <p className="auth-hero-foot">자취방 옷 위치·상태 기록</p>
      </aside>

      <main className="auth-main">
        <form className="auth-card" onSubmit={submit} noValidate>
          <Link to="/" className="landing-brand auth-brand-mobile"><img src="/favicon.svg" alt="" />옷결</Link>
          <h1>{isSignup ? '내 옷장을 만들어요' : '다시 오셨네요'}</h1>
          <p className="sub">{isSignup ? '이메일과 비밀번호만 있으면 바로 시작해요.' : '이메일로 로그인하고 내 옷장으로 돌아가요.'}</p>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="email">이메일</label>
              <input id="email" className="input" type="email" autoComplete="email" inputMode="email" autoCapitalize="none"
                placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="password">비밀번호</label>
              <div className="pw-wrap">
                <input id="password" className="input" type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isSignup ? MIN_PASSWORD : undefined} />
                <button type="button" className="pw-toggle" aria-pressed={showPassword} aria-label={showPassword ? '입력한 글자 숨기기' : '입력한 글자 보기'}
                  onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              {isSignup && (
                <span className={`field-hint pw-rule${longEnough ? ' ok' : ''}`}><IconCheck />{MIN_PASSWORD}자 이상</span>
              )}
            </div>
            {error && <Notice>{error}</Notice>}
          </div>

          <div className="auth-actions">
            <button className="btn btn-block" type="submit" disabled={busy}>
              {busy && <Spinner />}{isSignup ? '가입하기' : '로그인'}
            </button>
            <p className="auth-switch">
              {isSignup ? <>이미 계정이 있나요? <Link to="/login">로그인</Link></> : <>처음이세요? <Link to="/signup">회원가입</Link></>}
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}

export const Login = () => <AuthForm mode="login" />
export const Signup = () => <AuthForm mode="signup" />
