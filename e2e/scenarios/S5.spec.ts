import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const RECEIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/receipt.jpg')

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

// 앱은 한국 날짜로 회수 예정일을 계산한다. CI 러너(UTC)에서도 같은 날짜가 되게 서울 기준 오늘에서 센다.
function inDays(days: number) {
  const [y, m, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).split('-').map(Number)
  const d = new Date(y, m - 1, day + days)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

test('S5 사용자가 셔츠와 후드티를 영수증 사진과 함께 세탁소 묶음으로 맡기고 관리함에서 회수 예정일을 확인한다', async ({ page }) => {
  await login(page)

  // 메뉴에서 '옮기기'를 누른다
  await menu(page, '옮기기').click()

  // '세탁소'를 누른다
  await page.getByRole('tab', { name: '세탁소' }).click()

  // 세탁소에 '동네 세탁소'를 입력한다
  await page.getByLabel('세탁소', { exact: true }).fill('동네 세탁소')

  // 회수 예정일에서 '3일 뒤'를 누른다
  await page.getByRole('button', { name: '3일 뒤' }).click()

  // '영수증 찍기'로 세탁소 영수증 사진 1장을 올린다
  await page.getByLabel('영수증 찍기').setInputFiles(RECEIPT)
  await expect(page.getByRole('img', { name: '묶음 사진 1' })).toBeVisible()

  // 옮길 옷에서 '체크 플란넬 셔츠'와 '그레이 후드티'를 고른다
  const list = page.getByRole('group', { name: '옮길 옷 목록' })
  await list.getByRole('button', { name: /체크 플란넬 셔츠/ }).click()
  await list.getByRole('button', { name: /그레이 후드티/ }).click()

  // '동네 세탁소에 맡김 (2벌)'을 누른다
  await page.getByRole('button', { name: '동네 세탁소에 맡김 (2벌)' }).click()
  await expect(page.getByRole('status', { name: '옮긴 결과' })).toBeVisible()
  // 맡긴 직후 최근 옮긴 기록에 '사진 1장'이 함께 보인다
  await expect(page.getByRole('region', { name: '최근 옮긴 기록' }).getByRole('listitem').first()).toContainText('사진 1장')

  // 메뉴에서 '관리함'을 누른다
  await menu(page, '관리함').click()

  // '진행 중' 탭을 누른다
  await page.getByRole('tab', { name: /^진행 중/ }).click()

  // 두 벌이 '동네 세탁소'·3일 뒤 회수 예정, 상태 '세탁 중'
  const panel = page.getByRole('tabpanel', { name: '진행 중' })
  for (const name of ['체크 플란넬 셔츠', '그레이 후드티']) {
    const row = panel.getByLabel(`${name} 세탁`, { exact: true })
    await expect(row).toContainText('동네 세탁소')
    await expect(row).toContainText(`${inDays(3)} 회수 예정`)
    await expect(row).toContainText('세탁 중')
  }
})
