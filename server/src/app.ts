import express, { type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { authRouter } from './auth.js'
import { config } from './config.js'
import { errorHandler } from './http.js'
import { apiRouter } from './routes.js'
import { requireLogin } from './session.js'

/** React 화면 주소. 여기 없는 주소는 404 화면을 준다(없는 주소가 200 빈 화면이 되지 않게). 화면 주소를 추가하면 이 목록에도 추가한다. */
export const SPA_ROUTES = [/^\/login$/, /^\/signup$/, /^\/closet$/, /^\/closet\/\d+$/, /^\/register$/, /^\/map$/, /^\/care$/, /^\/move$/]

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  // nginx 뒤에서 https·클라이언트 주소를 그대로 받는다(쿠키 Secure 판단 등).
  app.set('trust proxy', 'loopback')
  app.use(express.json({ limit: '2mb' }))

  app.get('/__health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ releaseId: config.releaseId })
  })

  app.use('/api/auth', authRouter)
  app.use('/api', requireLogin, apiRouter)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: '요청한 주소를 찾을 수 없어요.' })
  })

  const index = join(config.staticDir, 'index.html')
  const notFound = join(config.staticDir, 'error', '404.html')
  app.use(express.static(config.staticDir, {
    index: 'index.html',
    setHeaders(res, path) {
      // 빌드 산출물(해시 이름)은 오래 캐시, index.html은 매번 새로
      if (/[\\/]assets[\\/]/.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      else if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')
    },
  }))
  app.get(/.*/, (req: Request, res: Response) => {
    if (SPA_ROUTES.some((r) => r.test(req.path)) && existsSync(index)) {
      res.set('Cache-Control', 'no-cache').sendFile(index)
      return
    }
    res.status(404)
    if (existsSync(notFound)) res.sendFile(notFound)
    else res.type('text/plain').send('Not Found')
  })

  app.use(errorHandler)
  return app
}
