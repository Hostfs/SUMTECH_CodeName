import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { SessionContext, type Me } from './session'
import type { Meta } from './types'

/** 로그인 상태, 도메인 선택지, 관리함 배지 숫자를 앱 전체에 준다. */
export default function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [careBadge, setCareBadge] = useState(0)

  useEffect(() => {
    api.get<Me>('/api/auth/me').then(setMe).catch(() => setMe(null))
  }, [])

  const refreshBadge = useCallback(() => {
    api.get<{ dueToday: unknown[]; overdue: unknown[] }>('/api/care')
      .then((b) => setCareBadge(b.dueToday.length + b.overdue.length))
      .catch(() => setCareBadge(0))
  }, [])

  useEffect(() => {
    if (!me) return
    api.get<Meta>('/api/meta').then(setMeta).catch(() => setMeta(null))
    refreshBadge()
  }, [me, refreshBadge])

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => undefined)
    setMe(null)
    setMeta(null)
  }, [])

  return <SessionContext.Provider value={{ me, meta, careBadge, setMe, refreshBadge, logout }}>{children}</SessionContext.Provider>
}
