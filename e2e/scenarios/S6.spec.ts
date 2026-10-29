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

test('S6 사용자가 새 수납 공간을 만들고 배치 추천을 확정해 옷 위치를 찾는다', async ({ page }) => {
  await login(page)

  // 메뉴에서 '보관함'을 누른다
  await menu(page, '보관함').click()

  // '옷장 지도' 탭을 누른다
  await storageTab(page, '옷장 지도').click()

  // '공간 추가'를 누른다
  await page.getByRole('button', { name: '공간 추가' }).click()

  // 공간 이름 '현관 행거', 유형 '걸기', 수용 개수 '3'
  const sheet = page.getByRole('dialog', { name: '공간 추가' })
  await sheet.getByLabel('공간 이름').fill('현관 행거')
  await sheet.getByRole('group', { name: '유형' }).getByRole('button', { name: '걸기', exact: true }).click()
  await sheet.getByLabel('수용 개수').fill('3')

  // '저장'을 누른다
  await sheet.getByRole('button', { name: '저장', exact: true }).click()
  await expect(sheet).toBeHidden()

  // '배치 추천 받기'를 누른다
  await page.getByRole('button', { name: '배치 추천 받기' }).click()

  // 추천안에서 '연청 데님 팬츠' 줄의 '배치 완료'를 누른다
  const row = page.getByLabel('연청 데님 팬츠 배치 추천', { exact: true })
  const proposed = await row.getByRole('combobox').evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex].text)
  await row.getByRole('button', { name: '배치 완료' }).click()
  await expect(row).toBeHidden()
  await expect(page.getByRole('article', { name: '현관 행거' })).toBeVisible()

  // 메뉴에서 '내 옷장'을 누른다
  await menu(page, '내 옷장').click()

  // 검색창에 '연청'을 입력한다
  await page.getByLabel('검색창').fill('연청')

  // 카드에 확정된 보관 위치 경로, '미배치' 표시 없음
  const card = page.getByTestId('garment-card').filter({ hasText: '연청 데님 팬츠' }).first()
  await expect(card).toContainText(proposed)
  await expect(card).not.toContainText('미배치')
})
