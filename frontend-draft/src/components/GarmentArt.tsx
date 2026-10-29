import type { Shape } from '../data/garments';

/** hex 를 amt(-1~1) 만큼 어둡게/밝게 */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
}

const SLEEVE_BODY = 'M36 12 L20 18 L8 64 L22 68 L28 42 V84 H68 V42 L74 68 L88 64 L76 18 L60 12 Q48 24 36 12Z';
const COAT_BODY = 'M34 10 L48 22 L62 10 L78 18 L90 66 L76 69 L69 38 V92 H27 V38 L20 69 L6 66 L18 18Z';

function parts(shape: Shape, hex: string, line: string) {
  const light = shade(hex, 0.28);
  switch (shape) {
    case 'tee':
      return <path d="M36 12 L18 20 L6 40 L20 47 L27 37 V84 H69 V37 L76 47 L90 40 L78 20 L60 12 Q48 24 36 12Z" />;
    case 'knit':
      return (
        <>
          <path d={SLEEVE_BODY} />
          <path d="M28 78H68" strokeDasharray="1.6 2.2" />
          <path d="M36 12 Q48 24 60 12" fill="none" />
        </>
      );
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
      );
    case 'coat':
      return (
        <>
          <path d={COAT_BODY} />
          <path d="M34 10 L45 38 L48 22Z M62 10 L51 38 L48 22Z" fill={light} />
          <path d="M48 22 V92" fill="none" />
          <circle cx="54" cy="54" r="1.4" fill={line} stroke="none" />
          <circle cx="54" cy="68" r="1.4" fill={line} stroke="none" />
        </>
      );
    case 'blazer':
      return (
        <>
          <path d={COAT_BODY.replace('V92 H27', 'V78 H27')} />
          <path d="M34 10 L45 38 L48 22Z M62 10 L51 38 L48 22Z" fill={light} />
          <path d="M48 22 V78 M32 66h10M54 66h10" fill="none" />
          <circle cx="53" cy="52" r="1.4" fill={line} stroke="none" />
        </>
      );
    case 'puffer':
      return (
        <>
          <path d="M36 12 Q48 20 60 12 L78 18 L90 64 L76 68 L69 40 V86 H27 V40 L20 68 L6 64 L18 18Z" />
          <path d="M28 34H68M28 50H68M28 66H68M48 18V86" fill="none" />
        </>
      );
    case 'pants':
      return (
        <>
          <path d="M28 8H68L73 90H54L48 40L42 90H23Z" />
          <path d="M28 16H68M48 16V40" fill="none" />
        </>
      );
    case 'shorts':
      return (
        <>
          <path d="M28 20H68L74 64H53L48 42L43 64H22Z" />
          <path d="M28 27H68" fill="none" />
        </>
      );
    case 'skirt':
      return (
        <>
          <path d="M33 16H63L84 82H12Z" />
          <path d="M33 22H63" fill="none" />
        </>
      );
    case 'pleated':
      return (
        <>
          <path d="M33 16H63L84 82H12Z" />
          <path d="M33 22H63M38 22L22 82M43 22L35 82M48 22V82M53 22L61 82M58 22L74 82" fill="none" />
        </>
      );
    case 'loafer':
      return (
        <>
          <path d="M8 64 Q10 54 24 52 L44 50 Q54 58 74 60 Q92 62 92 70 V74 H8Z" />
          <path d="M8 70H92M44 50 L52 56" fill="none" />
        </>
      );
    case 'boots':
      return (
        <>
          <path d="M30 12 H58 V52 Q58 58 70 60 Q92 62 92 72 V78 H16 V66 Q30 64 30 54Z" />
          <path d="M16 72H92M30 24H58" fill="none" />
        </>
      );
    case 'sneaker':
      return (
        <>
          <path d="M8 60 Q8 48 20 46 L34 44 Q40 54 52 54 L76 56 Q92 58 92 68 V74 H8Z" />
          <path d="M8 68H92M36 44 L40 38M44 48 L48 42" fill="none" />
        </>
      );
  }
}

interface Props {
  shape: Shape;
  hex: string;
  size?: number | string;
  className?: string;
}

export function GarmentArt({ shape, hex, size = '100%', className }: Props) {
  const line = shade(hex, -0.38);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={className}
      data-art=""
      fill={hex}
      stroke={line}
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {parts(shape, hex, line)}
    </svg>
  );
}
