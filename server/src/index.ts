import { createApp } from './app.js'
import { config } from './config.js'
import { migrate } from './migrate.js'
import { seedOnStartup } from './seed.js'

// 기동 순서: DB 연결을 기다림 → 마이그레이션 → 시드 → 0.0.0.0:3000에서 받기.
async function waitForDb() {
  const { pool } = await import('./db.js')
  for (let i = 0; ; i++) {
    try {
      await pool.query('SELECT 1')
      return
    } catch (e) {
      if (i >= 60) throw e
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

await waitForDb()
await migrate()
await seedOnStartup()
createApp().listen(config.port, '0.0.0.0', () => {
  console.log(`옷결 서버가 ${config.port}번 포트에서 시작했어요 (release ${config.releaseId})`)
})
