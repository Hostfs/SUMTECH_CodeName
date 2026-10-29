import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from '../env'

const here = path.dirname(fileURLToPath(import.meta.url))

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

test('S2 사용자가 택 사진 2장으로 새 옷을 AI 분석해 등록한다', async ({ page }) => {
  // 주최 측 자동 실행은 테스트마다 90초 제한이다. AI 응답 대기를 그 안에 나눠 둔다.
  test.setTimeout(90_000)
  await login(page)

  // 메뉴에서 '옷 등록'을 누른다
  await menu(page, '옷 등록').click()

  // '택 사진 추가'로 세탁 택 사진과 브랜드 택 사진 2장을 올린다
  await page.getByLabel('택 사진 추가').setInputFiles([
    path.join(here, '../fixtures/tag-care.jpg'),
    path.join(here, '../fixtures/tag-brand.jpg'),
  ])
  await expect(page.getByRole('img', { name: /택 사진 \d/ })).toHaveCount(2)

  // '택 분석하기'를 누른다(실제 AI 응답을 기다린다)
  await page.getByRole('button', { name: '택 분석하기' }).click()
  // 성공 안내나 실패 안내 중 먼저 나오는 것을 기다리고, 실패면 화면에 보인 이유를 그대로 실패 메시지에 남긴다.
  const done = page.getByText('택을 읽었어요')
  const failed = page.getByText('사진을 다시 찍거나')
  await expect(done.or(failed)).toBeVisible({ timeout: 45_000 })
  const reason = (await failed.allInnerTexts()).join(' ')
  expect(reason, `택 분석이 실패했어요: ${reason}`).toBe('')
  await expect(done).toBeVisible()

  // 분석 결과의 '옷 이름'에 '등록 테스트 셔츠'를 입력한다
  await page.getByLabel(/^옷 이름/).fill('등록 테스트 셔츠')

  // '제품 찾기'를 누른다
  const search = page.getByRole('region', { name: '제품 찾기' })
  await search.getByRole('button', { name: '제품 찾기' }).click()
  await expect(search.getByRole('group', { name: '제품 후보' }).or(search.getByText('검색 결과 없음'))).toBeVisible({ timeout: 25_000 })

  // '저장하기'를 누른다
  await page.getByRole('button', { name: '저장하기' }).click()

  // 옷 상세: 이름, 택 사진 2장, AI가 읽은 브랜드·소재, 제품 후보 또는 '검색 결과 없음'
  await expect(page).toHaveURL(/\/closet\/\d+/, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: '등록 테스트 셔츠' })).toBeVisible()
  await expect(page.getByRole('group', { name: '사진' }).getByRole('button', { name: '택 사진' })).toHaveCount(2)
  await expect(page.getByRole('region', { name: '택에서 읽은 정보' })).toBeVisible()
  const info = page.locator('.info-table')
  await expect(info.locator('.info-row', { hasText: '브랜드' }).locator('dd')).not.toHaveText('미입력')
  await expect(info.locator('.info-row', { hasText: '소재' }).locator('dd')).toContainText('%')
  const product = page.getByRole('region', { name: '제품 정보' })
  await expect(product.locator('[aria-label="제품 후보"]').or(product.getByText('검색 결과 없음'))).toBeVisible()
  // 마지막 화면에 AI가 읽은 값이 보이게 둔다
  await page.getByRole('region', { name: '택에서 읽은 정보' }).scrollIntoViewIfNeeded()
})
