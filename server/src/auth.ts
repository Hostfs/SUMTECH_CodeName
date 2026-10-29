import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { one, run } from './db.js'
import { ApiError, Check, handle, isBlank } from './http.js'
import { resetIfSeedUser } from './seed.js'
import { endSession, sessionUser, startSession } from './session.js'

/** 이메일·비밀번호 회원가입과 로그인. 역할은 '사용자' 하나다. */
export const authRouter = Router()

const EMAIL = /^[^\s@]+@[^\s@]+$/

const normalize = (email: string) => email.trim().toLowerCase()

/** Spring 때 저장한 해시({bcrypt}$2a$…)와 같은 형식으로 저장·검사한다. */
export async function hashPassword(raw: string) {
  return `{bcrypt}${await bcrypt.hash(raw, 10)}`
}

async function matches(raw: string, stored: string) {
  const hash = stored.startsWith('{bcrypt}') ? stored.slice('{bcrypt}'.length) : stored
  return hash.startsWith('$2') && bcrypt.compare(raw, hash)
}

authRouter.post('/signup', handle(async (req, res) => {
  const { email, password } = req.body ?? {}
  new Check()
    .when(isBlank(email), '이메일을 입력해 주세요.')
    .when(!isBlank(email) && !EMAIL.test(String(email).trim()), '이메일 형식이 올바르지 않아요.')
    .when(isBlank(password), '비밀번호를 입력해 주세요.')
    .when(typeof password === 'string' && (password.length < 8 || password.length > 100), '비밀번호는 8자 이상이어야 해요.')
    .done()
  const normalized = normalize(email)
  if (await one('SELECT id FROM users WHERE email = ?', [normalized])) {
    throw ApiError.conflict('이미 가입된 이메일이에요.')
  }
  const r = await run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', [normalized, await hashPassword(password), new Date()])
  startSession(req, res, r.insertId)
  return { id: r.insertId, email: normalized }
}, 201))

authRouter.post('/login', handle(async (req, res) => {
  const { email, password } = req.body ?? {}
  new Check()
    .when(isBlank(email), '이메일을 입력해 주세요.')
    .when(isBlank(password), '비밀번호를 입력해 주세요.')
    .done()
  const user = await one('SELECT id, email, password_hash FROM users WHERE email = ?', [normalize(email)])
  if (!user || !(await matches(password, user.password_hash))) {
    throw ApiError.unauthorized('이메일 또는 비밀번호가 맞지 않아요.')
  }
  await resetIfSeedUser(user.id, user.email)
  startSession(req, res, user.id)
  return { id: user.id, email: user.email }
}))

authRouter.post('/logout', handle(async (req, res) => {
  endSession(req, res)
}, 204))

/** 로그인하지 않았으면 401. 화면은 이 응답으로 로그인 여부를 판단한다. */
authRouter.get('/me', handle(async (req) => {
  const userId = sessionUser(req)
  if (userId === undefined) throw ApiError.unauthorized()
  const user = await one('SELECT id, email FROM users WHERE id = ?', [userId])
  if (!user) throw ApiError.unauthorized()
  return { id: user.id, email: user.email }
}))
