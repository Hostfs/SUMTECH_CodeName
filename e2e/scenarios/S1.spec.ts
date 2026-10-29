import { expect, test, type Page } from '@playwright/test'

function menu(page: Page, name: string) {
  return page.locator('nav[aria-label="주 메뉴"]:visible').getByRole('link', { name: new RegExp(`^${name}`) })
}

test('S1 처음 온 사람이 서비스 소개를 보고 회원가입해 빈 옷장을 연다', async ({ page }) => {
  const id = `s1-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const email = `${id}@example.com`

  // 첫 화면(로그인)에서 서비스 이름과 소개 문구를 확인하고 '회원가입'을 누른다
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: '옷결', level: 1 })).toBeVisible()
  await expect(page.getByText('내 옷이 어디에 있는지, 한눈에')).toBeVisible()
  await page.getByRole('link', { name: '회원가입' }).click()
  await expect(page).toHaveURL(/\/signup$/)

  // 회원가입 화면에서 이메일과 비밀번호를 입력한다
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill('password1234')

  // '가입하기'를 누른다
  await page.getByRole('button', { name: '가입하기' }).click()

  // 홈 인사말에 가입한 이메일의 아이디가 보인다(로그인된 상태)
  await expect(page.locator('.home-name')).toHaveText(`${id}님`)

  // 메뉴에서 '내 옷장'을 누른다
  await menu(page, '내 옷장').click()

  // 0벌 안내와 '옷 등록' 버튼
  await expect(page.getByText('등록된 옷이 0벌이에요')).toBeVisible()
  await expect(page.locator('.empty').getByRole('link', { name: '옷 등록' })).toBeVisible()
})
