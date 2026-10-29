import { resolve } from 'node:path'

// 환경변수. 이름은 주최 측 실행·배포 묶음과 같게 둔다(RELEASE_ID·SEED_USER_*·AI_GATEWAY_API_KEY는 바꾸지 않는다).

const env = process.env

/** jdbc:mariadb://host:3306/db 또는 mysql://user:pass@host:3306/db 모두 받는다(기존 배포 묶음의 값을 그대로 쓰게). */
function parseDatabaseUrl(raw: string) {
  const url = new URL(raw.replace(/^jdbc:/, '').replace(/^mariadb:/, 'mysql:'))
  return {
    host: url.hostname || '127.0.0.1',
    port: Number(url.port || 3306),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'otgyeol',
    user: env.DATABASE_USERNAME ?? (decodeURIComponent(url.username) || 'otgyeol'),
    password: env.DATABASE_PASSWORD ?? decodeURIComponent(url.password ?? ''),
  }
}

/**
 * AI 호출 대상. 주최 측 실행·CI는 Vercel AI Gateway 키를 넣으므로 기본은 Gateway다.
 * 키가 Google AI Studio 키(AIza…·AQ.…)면 같은 OpenAI 호환 형식의 Gemini 주소로 보낸다(배포 서버에 팀의 Gemini 키를 넣은 경우).
 */
function aiConfig() {
  const key = (env.AI_GATEWAY_API_KEY ?? '').trim()
  const model = env.AI_MODEL || 'google/gemini-2.5-flash'
  if (/^(AIza|AQ\.)/.test(key)) {
    // Google은 2.5 계열을 새 키에 더 열어 주지 않고(2026-10) 3.8 flash는 혼잡(503·지연)이 잦아 가벼운 flash-lite 최신판을 기본으로 둔다. AI_MODEL로 바꿀 수 있다.
    return { key, model: env.AI_MODEL ? env.AI_MODEL.replace(/^google\//, '') : 'gemini-flash-lite-latest', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', gateway: false }
  }
  return { key, model, baseUrl: 'https://ai-gateway.vercel.sh/v1', gateway: true }
}

export const config = {
  port: Number(env.PORT ?? 3000),
  releaseId: env.RELEASE_ID || 'dev',
  db: parseDatabaseUrl(env.DATABASE_URL || 'jdbc:mariadb://127.0.0.1:3306/otgyeol'),
  seedEmail: env.SEED_USER_EMAIL ?? '',
  seedPassword: env.SEED_USER_PASSWORD ?? '',
  ai: aiConfig(),
  kmaKey: env.KMA_API_KEY ?? '',
  /** 발표·QR 체험용. on이면 로그인 화면에 '게스트로 체험하기'가 생기고 누를 때마다 예시 옷장이 든 새 계정을 만든다. 기본은 꺼짐. */
  guestMode: /^(on|true|1|yes)$/i.test((env.GUEST_MODE ?? env.GUESTMODE ?? env.guestmode ?? '').trim()),
  /** 화면 빌드 결과(index.html·assets). docker에서는 /app/public. */
  staticDir: resolve(env.STATIC_DIR ?? new URL('../public', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
}
