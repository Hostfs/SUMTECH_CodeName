import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles.css'
import App from './App.tsx'

// 계절 테마: 서울 기준 이번 달로 정한다(3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울). 첫 화면부터 같은 색이 보이게 렌더 전에 둔다.
const month = Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date()))
document.documentElement.dataset.season = month >= 3 && month <= 5 ? 'spring' : month <= 8 && month >= 6 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
