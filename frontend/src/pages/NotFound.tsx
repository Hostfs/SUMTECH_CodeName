import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="auth auth-plain">
      <div className="auth-card">
        <h1>페이지를 찾을 수 없어요</h1>
        <p className="sub">주소가 바뀌었거나 없는 페이지예요.</p>
        <Link className="btn" to="/">첫 화면으로 가기</Link>
      </div>
    </div>
  )
}
