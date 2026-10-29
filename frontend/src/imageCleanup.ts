// 대표 이미지 정리(F4): 단색에 가까운 배경을 지우고, 옷을 같은 크기의 정사각 캔버스 가운데에 같은 여백으로 놓는다.
// 픽셀의 색은 바꾸지 않고 배경의 투명도만 바꾸므로 로고·무늬·색은 원본 그대로다.
// 배경이 복잡하거나 옷과 배경을 구분하지 못하면 오류를 던지고, 호출한 쪽이 원본을 대표 이미지로 유지한다.

import { api, errorMessage } from './api'
import type { GarmentDetail } from './types'

const WORK_MAX = 1024 // 계산용으로 줄이는 긴 변
const OUT_SIZE = 1024 // 결과 정사각 한 변
const PADDING = 0.12 // 결과 여백(한 변 대비). 목록 카드가 위아래를 조금 잘라도 옷이 잘리지 않게 넉넉히 둔다
const TOLERANCE = 42 // 배경색과의 RGB 거리 허용치(최대 441)
// 조명 때문에 배경이 한쪽으로 조금씩 어두워지는 경우: 바로 옆 배경 픽셀과 STEP 이내로 비슷하면 배경색과 2배까지 달라도 배경으로 본다.
const STEP = 10

export async function cleanupImage(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source).catch(() => {
    throw new Error('사진을 열지 못했어요.')
  })
  const scale = Math.min(1, WORK_MAX / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const work = document.createElement('canvas')
  work.width = w
  work.height = h
  const ctx = work.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('이 브라우저에서는 사진을 정리할 수 없어요.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const image = ctx.getImageData(0, 0, w, h)
  const px = image.data

  // 가장자리 픽셀로 배경색을 정한다. 가장자리가 한 가지 색에 가깝지 않으면 배경을 지우지 않는다.
  const border: number[] = []
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x)
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1)
  const bg = [0, 1, 2].map((c) => median(border.map((i) => px[i * 4 + c])))
  const distBg = (i: number) => {
    const o = i * 4
    const dr = px[o] - bg[0], dg = px[o + 1] - bg[1], db = px[o + 2] - bg[2]
    return dr * dr + dg * dg + db * db
  }
  const near = (i: number) => px[i * 4 + 3] < 16 || distBg(i) <= TOLERANCE * TOLERANCE
  // 이미 배경으로 본 픽셀(from)과 거의 같은 색이면 완만한 그러데이션으로 보고 이어서 지운다.
  const nearFrom = (n: number, from: number) => {
    if (distBg(n) > 4 * TOLERANCE * TOLERANCE) return false
    const a = n * 4, b = from * 4
    const dr = px[a] - px[b], dg = px[a + 1] - px[b + 1], db = px[a + 2] - px[b + 2]
    return dr * dr + dg * dg + db * db <= STEP * STEP
  }
  if (border.filter((i) => near(i) || distBg(i) <= 2.56 * TOLERANCE * TOLERANCE).length / border.length < 0.6) {
    throw new Error('배경이 한 가지 색이 아니라 자동으로 지우지 못했어요. 단색 바닥이나 벽 앞에서 다시 찍어 보세요.')
  }

  // 가장자리에서 이어진 배경색 영역만 지운다(옷 안쪽의 같은 색은 남는다).
  const isBg = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let head = 0, tail = 0
  for (const i of border) {
    if (!isBg[i] && near(i)) { isBg[i] = 1; queue[tail++] = i }
  }
  while (head < tail) {
    const i = queue[head++]
    const x = i % w
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]
    for (const n of next) {
      if (n >= 0 && n < w * h && !isBg[n] && (near(n) || nearFrom(n, i))) { isBg[n] = 1; queue[tail++] = n }
    }
  }

  let minX = w, minY = h, maxX = -1, maxY = -1, fg = 0
  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) { px[i * 4 + 3] = 0; continue }
    fg++
    const x = i % w, y = (i - x) / w
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  // 옷 외곽 한 줄은 배경색에 가까운 정도만큼 반투명하게 해서 계단처럼 잘린 테두리를 부드럽게 한다(색은 그대로).
  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) continue
    const x = i % w
    const touchesBg = (x > 0 && isBg[i - 1]) || (x < w - 1 && isBg[i + 1]) || (i >= w && isBg[i - w]) || (i + w < w * h && isBg[i + w])
    if (!touchesBg) continue
    const t = (Math.sqrt(distBg(i)) - TOLERANCE) / TOLERANCE
    px[i * 4 + 3] = Math.round(px[i * 4 + 3] * Math.min(1, Math.max(0.35, t)))
  }
  const ratio = fg / (w * h)
  if (ratio < 0.03 || ratio > 0.97) {
    throw new Error('옷과 배경을 구분하지 못했어요. 옷과 다른 색의 배경에서 다시 찍어 보세요.')
  }
  ctx.putImageData(image, 0, 0)

  // 옷이 차지한 영역을 정사각 캔버스 가운데에 같은 여백으로 놓는다.
  const bw = maxX - minX + 1, bh = maxY - minY + 1
  const inner = OUT_SIZE * (1 - PADDING * 2)
  const fit = inner / Math.max(bw, bh)
  const dw = bw * fit, dh = bh * fit
  const out = document.createElement('canvas')
  out.width = OUT_SIZE
  out.height = OUT_SIZE
  const octx = out.getContext('2d')
  if (!octx) throw new Error('이 브라우저에서는 사진을 정리할 수 없어요.')
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(work, minX, minY, bw, bh, (OUT_SIZE - dw) / 2, (OUT_SIZE - dh) / 2, dw, dh)
  return new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('정리한 사진을 만들지 못했어요.'))), 'image/png'))
}

/** 서버에 있는 옷 사진을 정리해 결과를 기록한다. 정리에 실패해도 실패로 기록해 원본이 대표 이미지로 남는다. */
export async function processGarmentImage(garmentId: number, imageId: number): Promise<{ detail: GarmentDetail; error: string }> {
  const body = new FormData()
  let error = ''
  try {
    const res = await fetch(`/api/images/${imageId}`, { credentials: 'same-origin' })
    if (!res.ok) throw new Error('사진을 불러오지 못했어요.')
    body.append('file', await cleanupImage(await res.blob()), 'processed.png')
  } catch (e) {
    error = errorMessage(e)
    body.append('failed', '1')
  }
  const detail = await api.post<GarmentDetail>(`/api/garments/${garmentId}/images/${imageId}/processing`, body)
  return { detail, error }
}

/** 대표 이미지가 아직 정리하지 않은 원본이면 정리한다. */
export async function processCoverIfNeeded(d: GarmentDetail): Promise<GarmentDetail> {
  const cover = d.images.find((i) => i.id === d.coverImageId)
  if (!cover || cover.processing || (cover.kind !== 'GARMENT_ORIGINAL' && cover.kind !== 'PRODUCT_ORIGINAL')) return d
  return (await processGarmentImage(d.summary.id, cover.id)).detail
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
