// 옷 종류별 평면 일러스트(디자인 초안 otgyeol-frontend GarmentArt 그대로). 실제 옷 색(colorHex)으로 칠한다. 사진이 없을 때 대표 이미지 대신 쓴다.

import { FALLBACK, shade, shapeOf, type ArtShape } from '../lib/garmentShape'

export type { ArtShape }

const SLEEVE_BODY = 'M36 12 L20 18 L8 64 L22 68 L28 42 V84 H68 V42 L74 68 L88 64 L76 18 L60 12 Q48 24 36 12Z'
const COAT_BODY = 'M34 10 L48 22 L62 10 L78 18 L90 66 L76 69 L69 38 V92 H27 V38 L20 69 L6 66 L18 18Z'

function parts(shape: ArtShape, hex: string, line: string) {
  const light = shade(hex, 0.28)
  switch (shape) {
    case 'tee':
      return <path d="M36 12 L18 20 L6 40 L20 47 L27 37 V84 H69 V37 L76 47 L90 40 L78 20 L60 12 Q48 24 36 12Z" />
    case 'longtee':
      return (
        <>
          <path d={SLEEVE_BODY} />
          <path d="M36 12 Q48 24 60 12" fill="none" />
        </>
      )
    case 'knit':
      return (
        <>
          <path d={SLEEVE_BODY} />
          <path d="M28 78H68" strokeDasharray="1.6 2.2" />
          <path d="M36 12 Q48 24 60 12" fill="none" />
        </>
      )
    case 'shirt':
      return (
        <>
          <path d={SLEEVE_BODY.replace('V84 H68', 'V86 H68')} />
          <path d="M36 12 L44 28 L48 20 L52 28 L60 12 Q48 24 36 12Z" fill={light} />
          <path d="M48 20 V86" fill="none" />
          <circle cx="48" cy="44" r="1.2" fill={line} stroke="none" />
          <circle cx="48" cy="58" r="1.2" fill={line} stroke="none" />
          <circle cx="48" cy="72" r="1.2" fill={line} stroke="none" />
        </>
      )
    case 'coat':
      return (
        <>
          <path d={COAT_BODY} />
          <path d="M34 10 L45 38 L48 22Z M62 10 L51 38 L48 22Z" fill={light} />
          <path d="M48 22 V92" fill="none" />
          <circle cx="54" cy="54" r="1.4" fill={line} stroke="none" />
          <circle cx="54" cy="68" r="1.4" fill={line} stroke="none" />
        </>
      )
    case 'blazer':
      return (
        <>
          <path d={COAT_BODY.replace('V92 H27', 'V78 H27')} />
          <path d="M34 10 L45 38 L48 22Z M62 10 L51 38 L48 22Z" fill={light} />
          <path d="M48 22 V78 M32 66h10M54 66h10" fill="none" />
          <circle cx="53" cy="52" r="1.4" fill={line} stroke="none" />
        </>
      )
    case 'puffer':
      return (
        <>
          <path d="M36 12 Q48 20 60 12 L78 18 L90 64 L76 68 L69 40 V86 H27 V40 L20 68 L6 64 L18 18Z" />
          <path d="M28 34H68M28 50H68M28 66H68M48 18V86" fill="none" />
        </>
      )
    case 'pants':
      return (
        <>
          <path d="M28 8H68L73 90H54L48 40L42 90H23Z" />
          <path d="M28 16H68M48 16V40" fill="none" />
        </>
      )
    case 'shorts':
      return (
        <>
          <path d="M28 20H68L74 64H53L48 42L43 64H22Z" />
          <path d="M28 27H68" fill="none" />
        </>
      )
    case 'skirt':
      return (
        <>
          <path d="M33 16H63L84 82H12Z" />
          <path d="M33 22H63" fill="none" />
        </>
      )
    case 'pleated':
      return (
        <>
          <path d="M33 16H63L84 82H12Z" />
          <path d="M33 22H63M38 22L22 82M43 22L35 82M48 22V82M53 22L61 82M58 22L74 82" fill="none" />
        </>
      )
    case 'dress':
      // 초안에 없는 원피스: 같은 선 굵기·비율로 그린 짧은 소매 A라인
      return (
        <>
          <path d="M37 10 L24 15 L14 33 L25 38 L31 29 L31 40 L16 90 H80 L65 40 L65 29 L71 38 L82 33 L72 15 L59 10 Q48 22 37 10Z" />
          <path d="M31 40 H65" fill="none" />
        </>
      )
    case 'loafer':
      return (
        <>
          <path d="M8 64 Q10 54 24 52 L44 50 Q54 58 74 60 Q92 62 92 70 V74 H8Z" />
          <path d="M8 70H92M44 50 L52 56" fill="none" />
        </>
      )
    case 'boots':
      return (
        <>
          <path d="M30 12 H58 V52 Q58 58 70 60 Q92 62 92 72 V78 H16 V66 Q30 64 30 54Z" />
          <path d="M16 72H92M30 24H58" fill="none" />
        </>
      )
    case 'sneaker':
      return (
        <>
          <path d="M8 60 Q8 48 20 46 L34 44 Q40 54 52 54 L76 56 Q92 58 92 68 V74 H8Z" />
          <path d="M8 68H92M36 44 L40 38M44 48 L48 42" fill="none" />
        </>
      )
  }
}

/** 초안 모양 이름으로 그린다(코디 스튜디오처럼 모양을 직접 고르는 곳). */
export function ShapeArt({ shape, hex, size = '100%', className }: { shape: ArtShape; hex?: string | null; size?: number | string; className?: string }) {
  const fill = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : FALLBACK
  const line = shade(fill, -0.38)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width={size} height={size} className={className} data-art=""
      fill={fill} stroke={line} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      {parts(shape, fill, line)}
    </svg>
  )
}

type Props = { subType: string; colorHex?: string | null; title?: string; size?: number | string; className?: string }

/** 옷 종류(subType)와 색으로 그린다. */
export default function GarmentArt({ subType, colorHex, title, size, className }: Props) {
  if (!title) return <ShapeArt shape={shapeOf(subType)} hex={colorHex} size={size} className={className} />
  return (
    <span role="img" aria-label={title} style={{ display: 'contents' }}>
      <ShapeArt shape={shapeOf(subType)} hex={colorHex} size={size} className={className} />
    </span>
  )
}
