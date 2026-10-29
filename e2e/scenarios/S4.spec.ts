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

test("S4 사용자가 여름 옷 두 벌을 한 번에 '여름 박스'로 옮기고 집 밖/박스 보기로 확인한다", async ({ page }) => {
  await login(page)

  // 메뉴에서 '옮기기'를 누른다
  await menu(page, '옮기기').click()

  // '박스·집 밖'을 누른다
  await page.getByRole('tab', { name: '박스·집 밖' }).click()

  // 보낼 곳에서 '여름 박스'를 고른다
  await page.getByRole('radiogroup', { name: '보낼 곳' }).getByRole('radio', { name: /^여름 박스/ }).click()

  // 옮길 옷에서 '린넨 반소매 셔츠'와 '네이비 반바지'를 고른다
  const list = page.getByRole('group', { name: '옮길 옷 목록' })
  await list.getByRole('button', { name: /린넨 반소매 셔츠/ }).click()
  await list.getByRole('button', { name: /네이비 반바지/ }).click()

  // '여름 박스로 보냄 (2벌)'을 누른다
  await page.getByRole('button', { name: '여름 박스로 보냄 (2벌)' }).click()
  await expect(page.getByRole('status', { name: '옮긴 결과' })).toBeVisible()

  // 메뉴에서 '내 옷장'을 누른다
  await menu(page, '내 옷장').click()

  // 보기 기준에서 '집 밖/박스'를 고른다
  await page.getByLabel('보기 기준').selectOption({ label: '집 밖/박스' })

  // '박스 속' 묶음에 두 벌, 위치는 '박스 속 · 여름 박스'
  const box = page.getByRole('region', { name: '박스 속 묶음' })
  for (const name of ['린넨 반소매 셔츠', '네이비 반바지']) {
    const card = box.getByTestId('garment-card').filter({ hasText: name })
    await expect(card).toBeVisible()
    await expect(card).toContainText('박스 속 · 여름 박스')
  }
})
