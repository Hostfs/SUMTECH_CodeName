import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { useSession, type Me } from '../session'
import { Notice, Spinner } from './Ui'

/**
 * 게스트 체험(서버 GUEST_MODE=on일 때만 보인다). 발표 자리에서 바로 들어온 사람이 가입 없이 예시 옷장으로 바로 써 본다.
 * 누를 때마다 다른 체험자와 섞이지 않는 새 계정이 만들어진다.
 * 모양은 디자인 초안의 보조 버튼(.btn-ghost): 주 버튼(시작하기·로그인) 옆이나 아래에 둔다.
 */
export default function GuestButton({ className = 'btn btn-ghost btn-block' }: { className?: string }) {
  const { setMe } = useSession()
  const navigate = useNavigate()
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<{ guestMode: boolean }>('/api/auth/options').then((o) => setOn(o.guestMode)).catch(() => setOn(false))
  }, [])

  if (!on) return null

  async function start() {
    setBusy(true)
    setError('')
    try {
      setMe(await api.post<Me>('/api/auth/guest'))
      navigate('/home', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={start}>{busy && <Spinner />}게스트로 체험하기</button>
      {error && <Notice>{error}</Notice>}
    </>
  )
}
