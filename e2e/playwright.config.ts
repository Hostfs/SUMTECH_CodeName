import { defineConfig } from '@playwright/test'
import { E2E_BASE_URL } from './env'

// 로컬·CI용 설정. 주최 측 실행은 이 파일을 쓰지 않고 같은 값의 자체 설정으로 돌린다(키트의 playwright.config.ts와 같은 값).
// docs/scenarios.yaml의 platform이 both라서 PC와 휴대폰 화면 모두에서 같은 흐름을 실행한다.
// 흐름은 같은 시드 계정을 쓰고 로그인할 때 시드 데이터가 초기화되므로 한 번에 하나씩 실행한다.
export default defineConfig({
  testDir: './scenarios',
  // docs/scenarios.yaml의 id와 같은 이름(S1.spec.ts, S2.spec.ts…)만 실행한다.
  testMatch: /[\/]S[1-9]\d*\.spec\.ts$/,
  // 주최 측 실행은 테스트마다 90초 제한이 있다.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_BASE_URL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // 주최 측 실행과 같은 화면 크기: PC 1440×900, 휴대폰 390×844(터치)
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
})
