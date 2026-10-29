import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express'
import multer from 'multer'

/** 사용자에게 이유를 그대로 보여 줄 수 있는 오류. 응답은 {"error": "이유"}. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
  static notFound(what: string) {
    return new ApiError(404, `${what}을(를) 찾을 수 없어요.`)
  }
  static badRequest(message: string) {
    return new ApiError(400, message)
  }
  static conflict(message: string) {
    return new ApiError(409, message)
  }
  static unauthorized(message = '로그인이 필요해요.') {
    return new ApiError(401, message)
  }
}

/** async 핸들러의 오류를 오류 처리기로 넘긴다. 반환값이 있으면 JSON으로 보낸다(status 기본 200). */
export function handle(fn: (req: Request, res: Response) => Promise<unknown> | unknown, status = 200): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .then((body) => {
        if (res.headersSent) return
        if (status === 204) {
          res.status(204).end()
        } else {
          res.status(status).json(body ?? null)
        }
      })
      .catch(next)
  }
}

/** 사진 업로드: 한 장 10MB까지(메모리에 받아 DB에 저장). */
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 4 } })

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  // express.json()이 읽지 못한 본문
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    res.status(400).json({ error: '입력 형식이 올바르지 않아요.' })
    return
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: '사진은 한 장에 10MB까지 올릴 수 있어요.' })
    } else {
      res.status(400).json({ error: '사진을 받지 못했어요. 다시 시도해 주세요.' })
    }
    return
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: '사진은 한 장에 10MB까지 올릴 수 있어요.' })
    return
  }
  // DB 제약(같은 주인 트리거 SIGNAL 45000, CHECK·UNIQUE·FK)이 막은 경우. 서버 검사를 통과한 경쟁 상황에서만 생긴다.
  const code: string | undefined = err?.code
  if (err?.sqlState === '45000' || err?.sqlState === '23000' || code === 'ER_DUP_ENTRY' || code === 'ER_CONSTRAINT_FAILED'
    || code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_ROW_IS_REFERENCED_2' || code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    res.status(409).json({ error: '저장할 수 없는 조합이에요. 화면을 새로고침한 뒤 다시 시도해 주세요.' })
    return
  }
  console.error(err)
  res.status(500).json({ error: '요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.' })
}

/** 요청 본문 검사. Spring의 @Valid처럼 실패한 필드의 안내 문장을 공백으로 이어 400으로 돌려준다. */
export class Check {
  private messages: string[] = []
  fail(message: string) {
    this.messages.push(message)
    return this
  }
  when(cond: boolean, message: string) {
    if (cond) this.messages.push(message)
    return this
  }
  done() {
    if (this.messages.length) throw new ApiError(400, this.messages.join(' '))
  }
}

export const isBlank = (v: unknown) => typeof v !== 'string' || v.trim() === ''
export const tooLong = (v: unknown, max: number) => typeof v === 'string' && [...v].length > max

/** 경로의 숫자 ID. 숫자가 아니면 400(Spring의 타입 변환 실패와 같게). */
export function idParam(req: Request, name = 'id'): number {
  const raw = req.params[name]
  const n = Number(raw)
  if (!Number.isSafeInteger(n)) throw new ApiError(400, '입력 형식이 올바르지 않아요.')
  return n
}
