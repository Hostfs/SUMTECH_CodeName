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

const card = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name},`) })

test("S4 사용자가 여름 옷 두 벌을 한 번에 '여름 박스'로 옮기고 위치별 보기로 확인한다", async ({ page }) => {
  await login(page)

  // 메뉴에서 '내 옷장'을 누른다
  await menu(page, '내 옷장').click()

  // '선택'을 누른다
  await page.getByRole('button', { name: '선택', exact: true }).click()

  // 목록에서 '린넨 반소매 셔츠'와 '네이비 반바지'를 고른다
  for (const name of ['린넨 반소매 셔츠', '네이비 반바지']) {
    await card(page, name).click()
    await expect(card(page, name)).toHaveAttribute('aria-pressed', 'true')
  }
  const bar = page.getByRole('region', { name: '선택한 옷' })
  await expect(bar).toContainText('2개 선택됨')

  // '위치 변경'을 누른다
  await bar.getByRole('button', { name: '위치 변경' }).click()

  // 보관 공간에서 '여름 박스'를 고르고 '여름 박스(으)로 변경'을 누른다
  const sheet = page.getByRole('dialog', { name: '2벌의 보관 위치 변경' })
  await sheet.getByRole('radio', { name: '여름 박스', exact: true }).click()
  await sheet.getByRole('button', { name: '여름 박스(으)로 변경' }).click()
  await expect(sheet).toBeHidden()

  // '필터'를 눌러 보기 기준에서 '위치별'을 고르고 '적용하기'를 누른다
  await page.getByRole('button', { name: /^필터/ }).click()
  const filter = page.getByRole('dialog', { name: '필터' })
  await filter.getByRole('button', { name: '위치별', exact: true }).click()
  await filter.getByRole('button', { name: '적용하기' }).click()

  // '여름 박스' 묶음에 두 벌, 카드 위치는 '여름 박스'
  const group = page.getByRole('region', { name: '여름 박스 묶음' })
  for (const name of ['린넨 반소매 셔츠', '네이비 반바지']) {
    const c = group.getByRole('button', { name: new RegExp(`^${name},`) })
    await expect(c).toBeVisible()
    await expect(c.locator('.gloc')).toHaveText('여름 박스')
  }
})
