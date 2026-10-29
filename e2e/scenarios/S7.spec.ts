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

function inDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

test('S7 사용자가 셔츠를 세탁소에 맡기고 회수 예정일을 기록한다', async ({ page }) => {
  const tomorrow = inDays(1)
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  await login(page)

  // 메뉴에서 '내 옷장'을 누른다
  await menu(page, '내 옷장').click()

  // 목록에서 '네이비 옥스퍼드 셔츠'를 연다
  await page.getByTestId('garment-card').filter({ hasText: '네이비 옥스퍼드 셔츠' }).first().click()

  // '세탁·수선 맡기기'를 누른다
  await page.getByRole('button', { name: '세탁·수선 맡기기' }).click()

  // 종류 '세탁', 맡긴 곳 '업체', 업체명 '동네 세탁소'
  const sheet = page.getByRole('dialog', { name: '세탁·수선 맡기기' })
  await sheet.getByRole('group', { name: '종류' }).getByRole('button', { name: '세탁', exact: true }).click()
  await sheet.getByRole('group', { name: '맡긴 곳' }).getByRole('button', { name: '업체', exact: true }).click()
  await sheet.getByLabel('업체명').fill('동네 세탁소')

  // 회수 예정일을 내일 날짜로 입력한다
  await sheet.getByLabel('회수 예정일').fill(iso)

  // '기록하기'를 누른다
  await sheet.getByRole('button', { name: '기록하기' }).click()
  await expect(sheet).toBeHidden()

  // 메뉴에서 '관리함'을 누른다
  await menu(page, '관리함').click()

  // '진행 중' 탭을 누른다
  await page.getByRole('tab', { name: /^진행 중/ }).click()

  // '진행 중'에 '동네 세탁소'·내일 회수 예정, 상태 '세탁 중'
  const row = page.getByRole('tabpanel', { name: '진행 중' }).getByLabel('네이비 옥스퍼드 셔츠 세탁', { exact: true })
  await expect(row).toContainText('동네 세탁소')
  await expect(row).toContainText(`${tomorrow.getMonth() + 1}월 ${tomorrow.getDate()}일 회수 예정`)
  await expect(row).toContainText('세탁 중')
})
