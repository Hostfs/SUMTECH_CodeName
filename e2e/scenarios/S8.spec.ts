import { expect, test, type Page } from '@playwright/test'

const SEED_EMAIL = process.env.SEED_USER_EMAIL ?? 'student@example.com'
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'loopthon-2026'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(SEED_EMAIL)
  await page.getByLabel('비밀번호').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(menu(page, '내 옷장')).toBeVisible()
}

function menu(page: Page, name: string) {
  return page.locator('nav[aria-label="주 메뉴"]:visible').getByRole('link', { name: new RegExp(`^${name}`) })
}

test('S8 사용자가 기한이 지난 세탁물을 회수하고 보관 위치를 다시 정한다', async ({ page }) => {
  await login(page)

  // 메뉴에서 '보관함'을 누른다
  await menu(page, '보관함').click()

  // '관리함' 탭을 누른다
  await page.getByRole('tab', { name: /^관리함/ }).click()

  // '기한 지남' 목록에서 '베이지 니트'의 '회수 완료'를 누른다
  const late = () => page.getByRole('list', { name: '기한 지남' }).getByRole('listitem').filter({ hasText: '베이지 니트' })
  await late().getByRole('button', { name: '회수 완료' }).click()
  await expect(late()).toHaveCount(0)

  // 메뉴에서 '내 옷장'을 누른다
  await menu(page, '내 옷장').click()

  // 회수 직후에는 위치 미확인(미배치)이다
  const c = page.getByRole('button', { name: /^베이지 니트,/ })
  await expect(c).toHaveAccessibleName(/미배치/)

  // 목록에서 '베이지 니트'를 연다
  await c.click()
  await expect(page.getByRole('heading', { name: '베이지 니트' })).toBeVisible()

  // '위치 변경'을 누르고 '서랍장'의 '2단'을 골라 '서랍장 › 2단(으)로 변경'을 누른다
  await page.getByRole('button', { name: '위치 변경' }).click()
  const sheet = page.getByRole('dialog', { name: '보관 위치 변경' })
  await sheet.getByRole('radio', { name: '2단', exact: true }).click()
  await sheet.getByRole('button', { name: '서랍장 › 2단(으)로 변경' }).click()
  await expect(sheet).toBeHidden()

  // 옷 정보: 상태 표시 없이(보관 중) 확정된 위치
  await expect(page.locator('.loc-card b')).toHaveText('서랍장 › 2단')
  await expect(page.locator('.title-row .badge')).toHaveCount(0)

  // '뒤로'를 누르고 메뉴에서 '보관함'을 누른 뒤 '관리함' 탭을 누른다
  await page.getByRole('button', { name: '뒤로' }).click()
  await menu(page, '보관함').click()
  await page.getByRole('tab', { name: /^관리함/ }).click()

  // '기한 지남'에서 사라지고 '완료 이력'에 회수 기록이 남는다
  await expect(late()).toHaveCount(0)
  await expect(page.getByRole('list', { name: '완료 이력' })).toContainText('베이지 니트 세탁 회수')
})
