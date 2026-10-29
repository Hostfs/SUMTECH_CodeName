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

/** 서울 기준 오늘부터 n일 뒤 YYYY-MM-DD */
const day = (n: number) => new Date(Date.now() + 9 * 3600_000 + n * 86400_000).toISOString().slice(0, 10)

test('S5 사용자가 수선 맡긴 바지의 회수 예정일을 미루고 관리함에서 확인한다', async ({ page }) => {
  await login(page)

  // 메뉴에서 '보관함'을 누른다
  await menu(page, '보관함').click()

  // '관리함' 탭을 누른다
  await page.getByRole('tab', { name: /^관리함/ }).click()

  // '오늘 회수 예정' 목록에서 '카키 치노 팬츠'의 '예정일 변경'을 누른다
  const todayList = page.getByRole('list', { name: '오늘 회수 예정' })
  await todayList.getByRole('listitem').filter({ hasText: '카키 치노 팬츠' }).getByRole('button', { name: '예정일 변경' }).click()

  // 회수 예정일을 3일 뒤 날짜로 입력한다
  const sheet = page.getByRole('dialog', { name: '회수 예정일 변경' })
  await sheet.getByLabel('회수 예정일').fill(day(3))

  // '변경'을 누른다
  await sheet.getByRole('button', { name: '변경', exact: true }).click()
  await expect(sheet).toBeHidden()

  const check = async () => {
    const row = page.getByRole('list', { name: '진행 중' }).getByRole('listitem').filter({ hasText: '카키 치노 팬츠' })
    await expect(row).toContainText('수선 · 미싱 수선실')
    await expect(row).toContainText('3일 뒤 회수 예정')
    await expect(page.getByRole('list', { name: '오늘 회수 예정' }).getByRole('listitem').filter({ hasText: '카키 치노 팬츠' })).toHaveCount(0)
  }
  await check()

  // 화면을 새로고침한 뒤 '관리함' 탭을 누른다: 서버에 저장된 예정일이 그대로다
  await page.reload()
  await page.getByRole('tab', { name: /^관리함/ }).click()
  await check()
})
