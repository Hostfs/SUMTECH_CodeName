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

test('S7 사용자가 지금 집 안에 있는 옷으로 코디를 추천받아 저장하고, 그 상의를 박스로 보낸 뒤 코디에서 위치를 확인한다', async ({ page }) => {
  await login(page)

  // 메뉴에서 '코디'를 누른다
  await menu(page, '코디').click()

  // '추천 받기'를 누른다
  await page.getByRole('button', { name: '추천 받기' }).click()

  // 집 안 옷으로 아우터·상의·하의가 채워지고 옷마다 보관 위치가 보인다
  const chosen = page.getByRole('list', { name: '고른 옷과 위치' })
  const item = (name: string) => chosen.getByRole('listitem').filter({ hasText: name })
  await expect(item('그레이 울 재킷')).toContainText('옷장 A → 왼쪽 행거')
  await expect(item('네이비 옥스퍼드 셔츠')).toContainText('옷장 A → 왼쪽 행거')
  await expect(item('블랙 슬랙스')).toContainText('서랍장 → 2단')
  // 세탁 중인 '베이지 니트'·수선 중인 '카키 치노 팬츠'·미배치 '연청 데님 팬츠'는 고르기 목록에 없고 숨긴 벌 수로만 보인다
  await expect(page.getByText('3벌 숨김')).toBeVisible()
  await page.getByRole('tab', { name: /^상의/ }).click()
  const rail = page.getByRole('tabpanel', { name: '상의 목록' })
  await expect(rail.getByRole('button', { name: /네이비 옥스퍼드 셔츠/ })).toBeVisible()
  await expect(rail.getByRole('button', { name: /베이지 니트/ })).toHaveCount(0)

  // '저장'을 누른다
  await page.getByRole('button', { name: '저장', exact: true }).click()

  // 이름에 '출근 코디'를 입력하고 '저장'을 누른다
  const sheet = page.getByRole('dialog', { name: '코디 저장' })
  await sheet.getByLabel('이름').fill('출근 코디')
  await sheet.getByRole('button', { name: '저장', exact: true }).click()
  await expect(sheet).toBeHidden()
  const look = page.getByTestId('outfit-look').filter({ hasText: '출근 코디' })
  await expect(look).toContainText('지금 입을 수 있어요')

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

  // 옮길 옷에서 '네이비 옥스퍼드 셔츠'를 고른다
  await page.getByRole('group', { name: '옮길 옷 목록' }).getByRole('button', { name: /네이비 옥스퍼드 셔츠/ }).click()

  // '여름 박스로 보냄 (1벌)'을 누른다
  await page.getByRole('button', { name: '여름 박스로 보냄 (1벌)' }).click()
  await expect(page.getByRole('status', { name: '옮긴 결과' })).toBeVisible()

  // 메뉴에서 '코디'를 누른다
  await menu(page, '코디').click()

  // '출근 코디'에 '네이비 옥스퍼드 셔츠'가 '박스 속 · 여름 박스'로 표시되고 '지금 입을 수 있어요' 대신 '지금 꺼낼 수 없는 옷이 있어요'가 보인다
  const after = page.getByTestId('outfit-look').filter({ hasText: '출근 코디' })
  await after.scrollIntoViewIfNeeded()
  await expect(after).toContainText('지금 꺼낼 수 없는 옷이 있어요')
  await expect(after).toContainText('네이비 옥스퍼드 셔츠 박스 속 · 여름 박스')
  await expect(after).not.toContainText('지금 입을 수 있어요')
})
