import { createContext, useContext } from 'react'
import type { Meta } from './types'

export type Me = { id: number; email: string }

/** 게스트 체험 계정(서버 GUEST_DOMAIN)은 임의 주소 대신 '게스트'로 보여 준다. */
export const isGuest = (me: Me | null | undefined) => !!me?.email.endsWith('@guest.otgyeol')
export const displayName = (me: Me | null | undefined) => (isGuest(me) ? '게스트' : me?.email ?? '')

export type Session = {
  me: Me | null | undefined // undefined: 확인 중
  meta: Meta | null
  careBadge: number
  setMe: (me: Me | null) => void
  refreshBadge: () => void
  logout: () => Promise<void>
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const s = useContext(SessionContext)
  if (!s) throw new Error('SessionProvider가 필요해요.')
  return s
}

/** 도메인 값의 한국어 이름. meta가 아직 없으면 값 그대로. */
export function useLabel() {
  const { meta } = useSession()
  return (group: keyof Meta, value: string | null | undefined): string => {
    if (!value) return ''
    const list = meta?.[group]
    if (Array.isArray(list)) {
      const hit = (list as { value: string; label: string }[]).find((o) => o.value === value)
      if (hit) return hit.label
    }
    return value
  }
}
