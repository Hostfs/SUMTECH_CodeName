// AiFallbackTests 이식: AI 키가 없을 때도 등록을 끝낼 수 있는지 확인한다. 택 판독은 실패 기록과 함께 직접 입력으로 이어지고,
// 제품 검색은 실패로 기록되며, 옷 상세에 택 사진과 검색 결과가 남는다. 실제 AI 호출은 E2E에서 주최 측 키로 확인한다.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Client, PNG_1x1, startServer, type TestServer } from './helpers.js'

let srv: TestServer

before(async () => {
  // helpers가 AI_GATEWAY_API_KEY를 비워 둔다(app.ai.gateway-key=)
  srv = await startServer()
})

after(async () => {
  await srv?.close()
})

test('registrationCompletesWithoutAiKey', async () => {
  const c = await new Client(srv.base).login()

  const form = new FormData()
  for (const name of ['care.png', 'brand.png']) form.append('files', new Blob([PNG_1x1], { type: 'image/png' }), name)
  const analyzed = await c.form('/api/labels/analyze', form)
  assert.equal(analyzed.status, 200, analyzed.raw)
  const a = analyzed.body
  assert.equal(a.extraction.status, 'FAILED')
  assert.ok(String(a.extraction.errorMessage).includes('AI 키'), a.extraction.errorMessage)
  assert.equal(a.extraction.imageIds.length, 2)
  const unread = JSON.stringify(a.unread)
  assert.ok(unread.includes('BRAND') && unread.includes('MATERIAL'), unread)
  const extractionId = a.extraction.id

  const search = (await c.post('/api/products/search', { extractionId, brand: '샘플', productCode: 'AB-123' })).body
  assert.equal(search.status, 'FAILED')
  assert.equal(search.candidates.length, 0)

  const created = (await c.post('/api/garments', { name: '등록 테스트 셔츠', subType: 'SHIRT', brand: '샘플', extractionId })).body
  const detail = (await c.get(`/api/garments/${created.summary.id}`)).body
  assert.equal(detail.summary.name, '등록 테스트 셔츠')
  assert.equal(detail.images.length, 2)
  assert.equal(detail.images[0].kind, 'LABEL')
  assert.equal(detail.search.status, 'FAILED')
})

test('productPageFetchRefusesInternalAddresses', async () => {
  const images: any = await import('../src/images.js')
  const isPublicHttp: (u: any) => boolean | Promise<boolean> = images.isPublicHttp
  assert.equal(typeof isPublicHttp, 'function', 'products.ts should export isPublicHttp (ProductSearchController.isPublicHttp)')
  for (const u of ['http://127.0.0.1/admin', 'http://localhost:3000/__health', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/', 'file:///etc/passwd']) {
    assert.equal(await isPublicHttp(new URL(u)), false, u)
  }
})
