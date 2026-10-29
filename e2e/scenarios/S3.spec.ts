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

test('S3 사용자가 옷의 계절 분류를 고치고 계절별 보기로 확인한다', async ({ page }) => {
  await login(page)

  // 메뉴에서 '내 옷장'을 누른다
  await menu(page, '내 옷장').click()

  // 목록에서 '화이트 반소매 티셔츠'를 연다
  await card(page, '화이트 반소매 티셔츠').click()
  await expect(page.getByRole('heading', { name: '화이트 반소매 티셔츠' })).toBeVisible()

  // '수정'을 누른다
  await page.getByRole('button', { name: '수정', exact: true }).click()

  // 계절에서 '봄'을 추가로 선택한다
  const sheet = page.getByRole('dialog', { name: '정보 수정' })
  await sheet.getByRole('button', { name: '봄', exact: true }).click()
  await expect(sheet.getByRole('button', { name: '봄', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // '저장'을 누른다
  await sheet.getByRole('button', { name: '저장', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(page.locator('.season-tags')).toContainText('봄')

  // '뒤로'를 눌러 내 옷장으로 돌아간다
  await page.getByRole('button', { name: '뒤로' }).click()

  // '필터'를 눌러 보기 기준에서 '계절별'을 고르고 '적용하기'를 누른다
  await page.getByRole('button', { name: /^필터/ }).click()
  const filter = page.getByRole('dialog', { name: '필터' })
  await filter.getByRole('button', { name: '계절별', exact: true }).click()
  await filter.getByRole('button', { name: '적용하기' }).click()

  // '봄'과 '여름' 묶음 모두에 '화이트 반소매 티셔츠'
  for (const season of ['봄', '여름']) {
    await expect(page.getByRole('region', { name: `${season} 묶음` }).getByRole('button', { name: /^화이트 반소매 티셔츠,/ })).toBeVisible()
  }

  // 화면을 새로고침한 뒤 '화이트 반소매 티셔츠'를 연다: 서버에 저장된 계절이 그대로다
  await page.reload()
  await card(page, '화이트 반소매 티셔츠').click()
  const tags = page.locator('.season-tags .tag')
  await expect(tags).toHaveCount(2)
  for (const season of ['봄', '여름']) await expect(tags.filter({ hasText: season })).toHaveCount(1)
})
