import type { Garment } from '../data/garments';
import { useImageUrl } from '../data/images';
import { GarmentArt } from './GarmentArt';

interface Props {
  g: Pick<Garment, 'shape' | 'hex' | 'photo' | 'name'>;
  /** 숫자면 그 크기(px)의 정사각형, '64%' 같은 문자열이면 부모 칸 안에서 가운데에 맞춘다 */
  size?: number | string;
}

/**
 * 옷 사진(누끼)이 있으면 사진을, 없으면 일러스트를 보여 준다.
 * 사진은 가로세로 비율이 제각각이라, 퍼센트 크기일 때는 부모 칸을 가득 덮는 상자 안에서 비율을 지킨 채 맞춘다
 * (칸 높이가 사진 비율을 따라 늘어나지 않게).
 */
export function GarmentImage({ g, size = '100%' }: Props) {
  const url = useImageUrl(g.photo);
  const fill = typeof size === 'string';
  const inner =
    g.photo && url ? (
      <img
        src={url}
        alt={g.name}
        draggable={false}
        // 퍼센트일 때는 최대 크기만 정해서 사진 비율대로 칸 안에 들어가게 한다 (사진 크기가 칸을 밀어내지 않게)
        style={fill ? { maxWidth: size, maxHeight: size, objectFit: 'contain', display: 'block' } : { width: size, height: size, objectFit: 'contain', display: 'block' }}
      />
    ) : (
      <GarmentArt shape={g.shape} hex={g.hex} size={size} />
    );
  return fill ? <span className="gfill">{inner}</span> : inner;
}
