import { expect, test, type Page } from '@playwright/test'

const SEED_EMAIL = process.env.SEED_USER_EMAIL ?? 'student@example.com'
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'loopthon-2026'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(SEED_EMAIL)
  await page.getByLabel('비밀번호').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/\/closet/)
}

function menu(page: Page, name: string) {
  return page.locator('nav[aria-label="주 메뉴"]:visible').getByRole('link', { name: new RegExp(`^${name}`) })
}

test('S8 사용자가 기한이 지난 세탁물을 회수하고 보관 위치를 다시 확인한다', async ({ page }) => {
  await login(page)

  // 메뉴에서 '관리함'을 누른다
  await menu(page, '관리함').click()

  // '기한 지남' 목록에서 '베이지 니트'의 '회수 완료'를 누른다
  await page.getByRole('tab', { name: /^기한 지남/ }).click()
  const overdue = page.getByRole('tabpanel', { name: '기한 지남' })
  await overdue.getByLabel('베이지 니트 세탁', { exact: true }).getByRole('button', { name: '회수 완료' }).click()
  await expect(page.getByText('회수 완료했어요')).toBeVisible()

  // '베이지 니트'를 눌러 옷 상세를 연다
  await page.getByRole('link', { name: '베이지 니트' }).first().click()

  // 제안된 위치를 확인하고 '재배치 확인'을 누른다
  await expect(page.getByText(/제안 위치: /)).toBeVisible()
  const suggested = (await page.getByText(/제안 위치: /).innerText()).replace('제안 위치: ', '').trim()
  await page.getByRole('button', { name: '재배치 확인' }).click()

  // 상태 '보관 중'과 확정 위치, 관리 이력에 회수 완료, '기한 지남'에서 사라짐
  await expect(page.locator('.info-row', { hasText: '상태' }).locator('dd')).toHaveText('보관 중')
  await expect(page.locator('.loc-card')).toContainText(suggested)
  await expect(page.getByRole('list', { name: '관리 이력' })).toContainText('회수 완료')
  await menu(page, '관리함').click()
  const tab = page.getByRole('tab', { name: /^기한 지남/ })
  await tab.click()
  await expect(page.getByRole('tabpanel', { name: '기한 지남' }).getByLabel('베이지 니트 세탁', { exact: true })).toHaveCount(0)
})
