import { expect, test } from '@playwright/test'

test('S1 처음 온 사람이 서비스 소개를 보고 회원가입해 빈 옷장을 연다', async ({ page }) => {
  const email = `s1-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`

  // 첫 화면에서 서비스 소개를 확인하고 '시작하기'를 누른다
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('옷결').first()).toBeVisible()
  await page.getByRole('link', { name: '시작하기' }).first().click()

  // 회원가입 화면에서 이메일과 비밀번호를 입력한다
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill('password1234')

  // '가입하기'를 누른다
  await page.getByRole('button', { name: '가입하기' }).click()

  // 가입한 이메일로 로그인된 상태로 홈이 열리고, 0벌 안내와 '옷 등록' 버튼
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByText(email).filter({ visible: true })).toBeVisible()
  await expect(page.getByText('등록된 옷이 0벌이에요')).toBeVisible()
  await expect(page.locator('.empty').getByRole('link', { name: '옷 등록' })).toBeVisible()
})
