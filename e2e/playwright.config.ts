import { defineConfig, devices } from '@playwright/test'

// docs/scenarios.yaml의 platform이 both라서 PC와 휴대폰 화면 모두에서 같은 흐름을 실행한다.
// 흐름은 같은 시드 계정을 쓰고 로그인할 때 시드 데이터가 초기화되므로 한 번에 하나씩 실행한다.
export default defineConfig({
  testDir: './scenarios',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
