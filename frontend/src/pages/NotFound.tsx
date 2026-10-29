import { Link } from 'react-router-dom'

/** 없는 주소. 디자인 초안의 NotFound와 같은 모양(.page .notfound: 가운데 제목·설명·주 버튼)이다. */
export default function NotFound() {
  return (
    <div className="page notfound">
      <h1>페이지를 찾을 수 없어요</h1>
      <p>주소가 바뀌었거나 없는 페이지예요.</p>
      <Link className="btn btn-primary" to="/">첫 화면으로 가기</Link>
    </div>
  )
}
