import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { Notice, Spinner } from '../components/Ui'
import { useSession } from '../session'

type Mode = 'login' | 'signup'

function AuthForm({ mode }: { mode: Mode }) {
  const { setMe } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isSignup = mode === 'signup'

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
      <form className="auth-card" onSubmit={submit} noValidate>
        <Link to="/" className="landing-brand"><img src="/favicon.svg" alt="" />옷결</Link>
        <h1>{isSignup ? '회원가입' : '로그인'}</h1>
        <p className="sub">{isSignup ? '이메일과 비밀번호로 내 옷장을 만들어요.' : '내 옷장으로 돌아가요.'}</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="email">이메일</label>
            <input id="email" className="input" type="email" autoComplete="email" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input id="password" className="input" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isSignup ? 8 : undefined} />
            {isSignup && <span className="field-hint">8자 이상</span>}
          </div>
          {error && <Notice>{error}</Notice>}
          <button className="btn btn-block" type="submit" disabled={busy}>
            {busy && <Spinner />}{isSignup ? '가입하기' : '로그인'}
          </button>
        </div>
        <p className="auth-switch">
          {isSignup ? <>이미 계정이 있나요? <Link to="/login">로그인</Link></> : <>처음이세요? <Link to="/signup">회원가입</Link></>}
        </p>
      </form>
    </div>
  )
}

export const Login = () => <AuthForm mode="login" />
export const Signup = () => <AuthForm mode="signup" />
