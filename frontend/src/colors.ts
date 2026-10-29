// 옷 색상 이름표. 팔레트에서 고르면 이름과 색 코드가 함께 채워지고,
// 스포이드·직접 고른 색은 가장 가까운 이름을 붙인다(사용자가 이름을 고칠 수 있다).

export const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: '블랙', hex: '#1c1c1e' },
  { name: '차콜', hex: '#3a3b3f' },
  { name: '그레이', hex: '#8e8f93' },
  { name: '라이트 그레이', hex: '#c9cacd' },
  { name: '화이트', hex: '#f6f5f1' },
  { name: '아이보리', hex: '#efe8d8' },
  { name: '베이지', hex: '#d9c8a9' },
  { name: '카멜', hex: '#b5895a' },
  { name: '브라운', hex: '#6b4a32' },
  { name: '카키', hex: '#6f6b45' },
  { name: '올리브', hex: '#5b6236' },
  { name: '그린', hex: '#2f7a4a' },
  { name: '민트', hex: '#9fd8c4' },
  { name: '네이비', hex: '#1f2a44' },
  { name: '블루', hex: '#2f5fb3' },
  { name: '연청', hex: '#8fb0d4' },
  { name: '스카이 블루', hex: '#a9d1ef' },
  { name: '퍼플', hex: '#6a4c93' },
  { name: '라벤더', hex: '#c7b8e3' },
  { name: '핑크', hex: '#efb3c4' },
  { name: '레드', hex: '#b8272f' },
  { name: '버건디', hex: '#6d1f2c' },
  { name: '오렌지', hex: '#e07a2e' },
  { name: '옐로', hex: '#f0cf4f' },
]

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 색 코드에 가장 가까운 팔레트 이름. 형식이 틀리면 null. */
export function nearestColorName(hex: string | null | undefined): string | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null
  const [r, g, b] = rgb(hex)
  let best = COLOR_PALETTE[0]
  let bestD = Infinity
  for (const c of COLOR_PALETTE) {
    const [cr, cg, cb] = rgb(c.hex)
    // 사람 눈이 초록에 더 민감한 것을 반영한 가중 거리
    const d = 2 * (r - cr) ** 2 + 4 * (g - cg) ** 2 + 3 * (b - cb) ** 2
    if (d < bestD) { bestD = d; best = c }
  }
  return best.name
}
