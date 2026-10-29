import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
// 디자인 초안(otgyeol-frontend)의 스타일을 같은 순서로 그대로 쓴다. 초안에 없는 우리 화면의 추가 스타일은 app.css와 각 화면의 *.app.css.
import './styles/theme.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/home.css'
import './styles/closet.css'
import './styles/detail.css'
import './styles/outfit.css'
import './styles/storage.css'
import './styles/notice.css'
import './styles/register.css'
import './styles/app.css'
import App from './App.tsx'
import { phaseAt } from './lib/daylight'
import { applyTheme } from './lib/season'

// 계절 테마(앱 색)와 하루의 때(밤이면 어두운 톤)를 첫 화면부터 맞춘다.
applyTheme()
const phase = phaseAt()
document.documentElement.dataset.phase = phase
document.documentElement.dataset.tone = phase === 'night' ? 'dark' : 'light'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
