import { expect, test, type Page } from '@playwright/test'

const SEED_EMAIL = process.env.SEED_USER_EMAIL ?? 'student@example.com'
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'loopthon-2026'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(SEED_EMAIL)
  await page.getByLabel('비밀번호').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/\/home/)
}

function menu(page: Page, name: string) {
  return page.locator('nav[aria-label="주 메뉴"]:visible').getByRole('link', { name: new RegExp(`^${name}`) })
}

test('S3 사용자가 옷의 계절 분류를 고치고 계절별 보기로 확인한다', async ({ page }) => {
  await login(page)

  // 메뉴에서 '내 옷장'을 누른다
  await menu(page, '내 옷장').click()

  // 목록에서 '화이트 반소매 티셔츠'를 연다
  await page.getByTestId('garment-card').filter({ hasText: '화이트 반소매 티셔츠' }).first().click()

  // '정보 수정'을 누른다
  await page.getByRole('button', { name: '정보 수정' }).click()

  // 계절에서 '봄'을 추가로 선택한다
  const sheet = page.getByRole('dialog', { name: '정보 수정' })
  await sheet.getByRole('group', { name: /계절/ }).getByRole('button', { name: '봄', exact: true }).click()

  // '저장'을 누른다
  await sheet.getByRole('button', { name: '저장', exact: true }).click()
  await expect(sheet).toBeHidden()

  // 메뉴에서 '내 옷장'을 누른다
  await menu(page, '내 옷장').click()

  // 보기 기준에서 '계절'을 고른다
  await page.getByLabel('보기 기준').selectOption({ label: '계절' })

  // 화면을 새로고침한다
  await page.reload()

  // '봄'과 '여름' 묶음 모두에 '화이트 반소매 티셔츠'
  for (const season of ['봄', '여름']) {
    const group = page.getByRole('region', { name: `${season} 묶음` })
    await expect(group.getByTestId('garment-card').filter({ hasText: '화이트 반소매 티셔츠' })).toBeVisible()
  }
  await expect(page.getByLabel('보기 기준')).toHaveValue('season')
})
