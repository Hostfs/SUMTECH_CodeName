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

function storageTab(page: Page, name: string) {
  return page.getByRole('navigation', { name: '보관함 보기' }).getByRole('link', { name: new RegExp(`^${name}`) })
}

test("S4 사용자가 '처음 보는 옷'까지 더해 여름 옷을 '여름 박스'에 묶음 보관한 뒤 한 벌을 다시 집 안 옷장으로 꺼낸다", async ({ page }) => {
  await login(page)

  // 메뉴에서 '보관함'을 누른다
  await menu(page, '보관함').click()

  // '옮기기' 탭을 누른다
  await storageTab(page, '옮기기').click()

  // '박스·집 밖'을 누른다
  await page.getByRole('tab', { name: '박스·집 밖' }).click()

  // 보낼 곳에서 '여름 박스'를 고른다
  const box = page.getByRole('radio', { name: /^여름 박스/ })
  await box.click()
  await expect(box).toHaveAttribute('aria-checked', 'true')

  // '처음 보는 옷'에 '스트라이프 마 셔츠'(셔츠)를 넣고 '등록하고 넣기'를 누른다
  await page.getByRole('button', { name: '처음 보는 옷' }).click()
  await page.getByLabel('옷 이름').fill('스트라이프 마 셔츠')
  await page.getByLabel('옷 종류').selectOption({ label: '셔츠' })
  await page.getByRole('button', { name: '등록하고 넣기' }).click()
  const list = page.getByRole('group', { name: '옮길 옷 목록' })
  const added = list.getByRole('button').first()
  await expect(added).toContainText('스트라이프 마 셔츠')
  await expect(added).toHaveAttribute('aria-pressed', 'true')

  // 옮길 옷에서 '린넨 반소매 셔츠'와 '네이비 반바지'를 추가로 고른다
  await list.getByRole('button', { name: /린넨 반소매 셔츠/ }).click()
  await list.getByRole('button', { name: /네이비 반바지/ }).click()

  // '여름 박스로 보냄 (3벌)'을 누른다
  await page.getByRole('button', { name: '여름 박스로 보냄 (3벌)' }).click()
  await expect(page.getByRole('status', { name: '옮긴 결과' })).toBeVisible()

  // 메뉴에서 '내 옷장'을 누른다
  await menu(page, '내 옷장').click()

  // 보기 기준에서 '집 밖/박스'를 고른다
  await page.getByLabel('보기 기준').selectOption({ label: '집 밖/박스' })

  // '박스 속' 묶음에 세 벌, 위치는 '박스 속 · 여름 박스'
  const boxGroup = page.getByRole('region', { name: '박스 속 묶음' })
  for (const name of ['스트라이프 마 셔츠', '린넨 반소매 셔츠', '네이비 반바지']) {
    const card = boxGroup.getByTestId('garment-card').filter({ hasText: name })
    await expect(card).toBeVisible()
    await expect(card).toContainText('박스 속 · 여름 박스')
  }

  // '박스 속' 묶음의 '네이비 반바지' 카드에서 '꺼내기'를 누른다(옷 상세를 열지 않는다)
  await boxGroup.getByRole('button', { name: '네이비 반바지 꺼내기' }).click()

  // 꺼내서 둘 곳에서 '옷장 A → 왼쪽 행거'를 고르고 '여기에 둠'을 누른다
  const sheet = page.getByRole('dialog', { name: '네이비 반바지 꺼내기' })
  await sheet.getByRole('radiogroup', { name: '꺼내서 둘 곳' }).getByRole('button', { name: /^옷장 A → 왼쪽 행거/ }).click()
  await sheet.getByRole('button', { name: '여기에 둠' }).click()
  await expect(sheet).toBeHidden()

  // '박스 속' 묶음에서 빠지고, 카드의 위치가 '옷장 A → 왼쪽 행거'로 바뀐다
  await expect(boxGroup.getByTestId('garment-card').filter({ hasText: '네이비 반바지' })).toHaveCount(0)
  const moved = page.getByTestId('garment-card').filter({ hasText: '네이비 반바지' })
  await expect(moved).toContainText('옷장 A → 왼쪽 행거')
  await expect(moved).not.toContainText('여름 박스')
})
