import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))
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

test('S2 사용자가 택 사진 2장을 AI로 읽어 새 옷을 등록한다', async ({ page }) => {
  test.setTimeout(240_000)
  await login(page)

  // 메뉴에서 '옷 등록'을 누른다
  await menu(page, '옷 등록').click()

  // 옷 종류에서 '상의'를 고른다
  await page.getByRole('radio', { name: /^상의/ }).click()

  // '택·제품 코드'를 누른다
  await page.getByRole('button', { name: /^택·제품 코드/ }).click()

  // '택 사진 추가'로 세탁 택 사진과 브랜드 택 사진 2장을 올린다
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: '택 사진 추가' }).click(),
  ])
  await chooser.setFiles([path.join(here, '../fixtures/tag-care.jpg'), path.join(here, '../fixtures/tag-brand.jpg')])
  await expect(page.locator('.photo-row img')).toHaveCount(2)

  // '사진 찾기'를 누른다(실제 AI 응답을 기다린다: 택 글자 읽기 → 상품 사진 검색)
  const panel = page.locator('section.panel')
  const brand = panel.getByRole('textbox', { name: '브랜드' })
  const failed = panel.locator('.notice', { hasText: '직접 입력해 주세요' })
  await panel.getByRole('button', { name: '사진 찾기' }).click()
  await expect
    .poll(async () => ((await failed.count()) ? 'failed' : await brand.inputValue()), { timeout: 120_000 })
    .not.toBe('')
  const reason = (await failed.allInnerTexts()).join(' ')
  expect(reason, `택 글자 읽기가 실패했어요: ${reason}`).toBe('')
  // 상품 검색이 끝날 때까지(후보 목록이나 안내 문구) 기다린다
  const reading = panel.locator('.notice', { hasText: '읽는 중' })
  await expect(panel.locator('.hits').or(panel.locator('.notice')).first()).toBeVisible({ timeout: 120_000 })
  await expect(reading).toHaveCount(0, { timeout: 120_000 })

  // '사진 없이'를 누른다
  await page.getByRole('button', { name: /^사진 없이/ }).click()

  // 옷 정보의 '옷 이름'에 '등록 테스트 셔츠'를 입력한다
  await page.getByLabel(/^옷 이름/).fill('등록 테스트 셔츠')

  // '저장하기'를 누른다
  await page.getByRole('button', { name: '저장하기' }).click()

  // 옷 정보: 이름, AI가 택에서 읽은 브랜드와 소재(혼용률 %)
  await expect(page).toHaveURL(/\/closet\/\d+/, { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: '등록 테스트 셔츠' })).toBeVisible()
  const cell = (label: string) => page.locator('.info-grid .cell', { has: page.locator('dt', { hasText: label }) }).locator('dd')
  await expect(cell('브랜드')).not.toHaveText('미입력')
  await expect(cell('소재')).toContainText('%')
})
