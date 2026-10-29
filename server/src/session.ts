import { randomBytes } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { ApiError } from './http.js'

/**
 * 세션 쿠키 로그인. 화면과 API가 같은 주소에서 제공되므로 SameSite=Lax 쿠키로 다른 사이트의 요청을 막는다.
 * 세션은 서버 메모리에 둔다(서버가 하나라서 충분하고, Spring 때와 같이 재시작하면 다시 로그인한다).
 */
const COOKIE = 'OTGYEOL_SESSION'
const TTL_MS = 14 * 24 * 60 * 60 * 1000
const sessions = new Map<string, { userId: number; expires: number }>()

function readCookie(req: Request): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE) return decodeURIComponent(v.join('='))
  }
  return undefined
}

function cookieOptions(req: Request) {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: req.secure, maxAge: TTL_MS }
}

/** 로그인한 사용자 ID. 없으면 undefined. */
export function sessionUser(req: Request): number | undefined {
  const sid = readCookie(req)
  if (!sid) return undefined
  const s = sessions.get(sid)
  if (!s) return undefined
  if (s.expires < Date.now()) {
    sessions.delete(sid)
    return undefined
  }
  s.expires = Date.now() + TTL_MS
  return s.userId
}

/** 로그인. 이전 세션 ID는 버리고 새로 발급한다(세션 고정 방지). */
export function startSession(req: Request, res: Response, userId: number) {
  const old = readCookie(req)
  if (old) sessions.delete(old)
  const sid = randomBytes(24).toString('base64url')
  sessions.set(sid, { userId, expires: Date.now() + TTL_MS })
  res.cookie(COOKIE, sid, cookieOptions(req))
}

export function endSession(req: Request, res: Response) {
  const sid = readCookie(req)
  if (sid) sessions.delete(sid)
  res.clearCookie(COOKIE, { path: '/' })
}

/** /api/auth/**를 뺀 모든 /api/** 요청은 로그인이 필요하다. 없으면 401. */
export function requireLogin(req: Request, _res: Response, next: NextFunction) {
  const userId = sessionUser(req)
  if (userId === undefined) {
    next(ApiError.unauthorized())
    return
  }
  req.userId = userId
  next()
}

/** 핸들러 안에서 로그인한 사용자 ID. */
export function currentUser(req: Request): number {
  if (req.userId === undefined) throw ApiError.unauthorized()
  return req.userId
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number
    }
  }
}
