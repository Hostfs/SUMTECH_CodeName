// 옷 종류별 평면 일러스트. 실제 옷 색(colorHex)으로 칠한다. 사진이 없을 때 대표 이미지 대신 쓴다.

type Props = { subType: string; colorHex?: string | null; title?: string }

const FALLBACK = '#d9d3c9'

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * (1 + amount))))
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

type Kind = 'tee' | 'long' | 'knit' | 'shirt' | 'jacket' | 'coat' | 'pants' | 'jeans' | 'shorts' | 'skirt' | 'dress' | 'etc'

const KIND: Record<string, Kind> = {
  SHORT_SLEEVE_TEE: 'tee', LONG_SLEEVE_TEE: 'long', KNIT: 'knit', SHIRT: 'shirt', TOP_ETC: 'long',
  JACKET: 'jacket', COAT: 'coat', OUTER_ETC: 'jacket',
  PANTS: 'pants', JEANS: 'jeans', SHORTS: 'shorts', SKIRT: 'skirt', BOTTOM_ETC: 'pants',
  DRESS: 'dress', ETC: 'etc',
}

const LONG_BODY = 'M44 24 L31 30 L23 60 L19 86 L29 88 L37 62 L37 100 L83 100 L83 62 L91 88 L101 86 L97 60 L89 30 L76 24 Q60 34 44 24 Z'

export default function GarmentArt({ subType, colorHex, title }: Props) {
  const fill = colorHex && /^#[0-9a-fA-F]{6}$/.test(colorHex) ? colorHex : FALLBACK
  const dark = luminance(fill) < 0.35
  const stroke = dark ? shade(fill, 0.55) : shade(fill, -0.38)
  const detail = dark ? shade(fill, 0.35) : shade(fill, -0.22)
  const s = { fill, stroke, strokeWidth: 2, strokeLinejoin: 'round' as const }
  const line = { fill: 'none', stroke: detail, strokeWidth: 1.6, strokeLinecap: 'round' as const }
  const kind = KIND[subType] ?? 'etc'

  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={title ?? '옷 그림'}>
      {kind === 'tee' && (
        <>
          <path {...s} d="M44 26 L31 32 L19 49 L29 58 L37 50 L37 99 L83 99 L83 50 L91 58 L101 49 L89 32 L76 26 Q60 37 44 26 Z" />
          <path {...line} d="M47 27 Q60 35 73 27" />
        </>
      )}
      {(kind === 'long' || kind === 'knit') && (
        <>
          <path {...s} d={LONG_BODY} />
          <path {...line} d="M47 25 Q60 33 73 25" />
          {kind === 'knit' && <path {...line} d="M38 94 H82 M42 94 V100 M48 94 V100 M54 94 V100 M60 94 V100 M66 94 V100 M72 94 V100 M78 94 V100 M20 82 L29 84 M92 84 L100 82" />}
        </>
      )}
      {kind === 'shirt' && (
        <>
          <path {...s} d={LONG_BODY} />
          <path {...s} d="M45 23 L60 37 L75 23 L71 18 L60 27 L49 18 Z" />
          <path {...line} d="M60 37 V100" />
          {[46, 58, 70, 82, 94].map((y) => <circle key={y} cx="63.5" cy={y} r="1.5" fill={detail} />)}
        </>
      )}
      {(kind === 'jacket' || kind === 'coat') && (
        <>
          <path {...s} d={kind === 'coat'
            ? 'M44 20 L31 26 L23 58 L19 86 L29 88 L37 60 L35 110 L85 110 L83 60 L91 88 L101 86 L97 58 L89 26 L76 20 Q60 26 44 20 Z'
            : LONG_BODY} />
          <path {...s} d="M45 21 L52 44 L60 64 L56 40 Z" />
          <path {...s} d="M75 21 L68 44 L60 64 L64 40 Z" />
          <path {...line} d={kind === 'coat' ? 'M60 64 V110' : 'M60 64 V100'} />
          <circle cx="60" cy="74" r="1.8" fill={detail} />
          <circle cx="60" cy="86" r="1.8" fill={detail} />
          <path {...line} d={kind === 'coat' ? 'M41 92 H52 M68 92 H79' : 'M42 86 H52 M68 86 H78'} />
        </>
      )}
      {(kind === 'pants' || kind === 'jeans') && (
        <>
          <path {...s} d="M38 18 L82 18 L87 106 L66 106 L60 50 L54 106 L33 106 Z" />
          <path {...line} d="M38 27 H82 M60 27 V50" />
          {kind === 'jeans' && <path {...line} strokeDasharray="2.5 2.5" d="M42 31 Q48 40 56 34 M78 31 Q72 40 64 34 M36 100 H54 M66 100 H84" />}
        </>
      )}
      {kind === 'shorts' && (
        <>
          <path {...s} d="M36 34 L84 34 L89 78 L65 78 L60 54 L55 78 L31 78 Z" />
          <path {...line} d="M36 42 H84 M60 42 V54" />
        </>
      )}
      {kind === 'skirt' && (
        <>
          <path {...s} d="M45 24 L75 24 L92 98 Q60 104 28 98 Z" />
          <path {...line} d="M45 31 H75 M52 31 L44 100 M60 31 V102 M68 31 L76 100" />
        </>
      )}
      {kind === 'dress' && (
        <>
          <path {...s} d="M48 18 L54 18 L60 28 L66 18 L72 18 L74 46 L92 102 Q60 108 28 102 L46 46 Z" />
          <path {...line} d="M46 46 H74" />
        </>
      )}
      {kind === 'etc' && (
        <>
          <path {...s} d="M34 30 H74 L92 60 L74 90 H34 Z" />
          <circle cx="76" cy="60" r="4" fill="#fff" stroke={stroke} strokeWidth="2" />
        </>
      )}
    </svg>
  )
}
