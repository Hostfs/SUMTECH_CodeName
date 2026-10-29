import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../lib/auth';
import { errorText } from '../lib/api';

/** 로그인·회원가입 (R00). 가입하면 바로 로그인되고, 계정마다 옷장이 따로다. */
export default function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const { me, login, signup } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  if (me) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('이메일과 비밀번호를 입력해 주세요');
    if (!isLogin && password.length < 8) return setError('비밀번호는 8자 이상이어야 해요');
    setBusy(true);
    try {
      await (isLogin ? login : signup)(email.trim(), password);
      nav(from, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page auth">
      <div className="auth-brand">
        <span className="auth-logo"><Icon name="hanger" size={30} /></span>
        <h1>옷결</h1>
        <p>내 옷이 어디에 있는지, 한눈에</p>
      </div>

      <form className="fields" onSubmit={submit} noValidate>
        <label className="field">
          <span>이메일</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-invalid={!!error} />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isLogin ? '' : '8자 이상'} aria-invalid={!!error} />
        </label>
        {error && <p className="notice warn" role="alert"><Icon name="alert" size={16} />{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{isLogin ? '로그인' : '가입하기'}</button>
      </form>

      <p className="auth-switch">
        {isLogin ? '처음이신가요?' : '이미 계정이 있나요?'}
        <Link to={isLogin ? '/signup' : '/login'} state={{ from }} className="link-btn">{isLogin ? '회원가입' : '로그인'}</Link>
      </p>
    </div>
  );
}
