import { expect, test, type Page } from '@playwright/test'
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from '../env'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(E2E_USER_EMAIL)
  await page.getByLabel('비밀번호').fill(E2E_USER_PASSWORD)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/\/home/)
}

function menu(page: Page, name: string) {
  return page.locator('nav[aria-label="주 메뉴"]:visible').getByRole('link', { name: new RegExp(`^${name}`) })
}

function storageTab(page: Page, name: string) {
  return page.getByRole('navigation', { name: '보관함 보기' }).getByRole('link', { name: new RegExp(`^${name}`) })
}

// 앱은 한국 날짜로 회수 예정일을 계산한다. CI 러너(UTC)에서도 같은 날짜가 되게 서울 기준 오늘에서 센다.
function inDays(days: number) {
  const [y, m, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).split('-').map(Number)
  const d = new Date(y, m - 1, day + days)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

test('S5 사용자가 셔츠와 후드티를 세탁소 묶음으로 한 번에 맡기고 관리함에서 회수 예정일을 확인한다', async ({ page }) => {
  await login(page)

  // 메뉴에서 '보관함'을 누른다
  await menu(page, '보관함').click()

  // '옮기기' 탭을 누른다
  await storageTab(page, '옮기기').click()

  // '세탁소'를 누른다
  await page.getByRole('tab', { name: '세탁소' }).click()

  // 세탁소에 '동네 세탁소'를 입력한다
  await page.getByLabel('세탁소', { exact: true }).fill('동네 세탁소')

  // 회수 예정일에서 '3일 뒤'를 누른다
  await page.getByRole('button', { name: '3일 뒤' }).click()

  // 옮길 옷에서 '체크 플란넬 셔츠'와 '그레이 후드티'를 고른다
  const list = page.getByRole('group', { name: '옮길 옷 목록' })
  await list.getByRole('button', { name: /체크 플란넬 셔츠/ }).click()
  await list.getByRole('button', { name: /그레이 후드티/ }).click()

  // '동네 세탁소에 맡김 (2벌)'을 누른다
  await page.getByRole('button', { name: '동네 세탁소에 맡김 (2벌)' }).click()
  await expect(page.getByRole('status', { name: '옮긴 결과' })).toBeVisible()

  // 메뉴에서 '보관함'을 누른다
  await menu(page, '보관함').click()

  // '관리함' 탭을 누른다
  await storageTab(page, '관리함').click()

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
