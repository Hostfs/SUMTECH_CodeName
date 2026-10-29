import { useId } from "react";
import type { WeatherCondition } from "@/lib/weather/types";

// 구름 모양 하나 (목업 SVG와 같은 도형)
const Cloud = ({ x, y, scale, fill, opacity }: { x: number; y: number; scale: number; fill: string; opacity: number }) => (
  <g transform={`translate(${x},${y}) scale(${scale})`} fill={fill} opacity={opacity}>
    <ellipse cx="0" cy="0" rx="78" ry="24" />
    <circle cx="-28" cy="-16" r="28" />
    <circle cx="10" cy="-26" r="36" />
    <circle cx="48" cy="-10" r="24" />
  </g>
);

/**
 * 홈 날씨 배경. 화면 위쪽 절반에만 깔리고 아래는 --bg로 이어진다 (design-system 1절).
 * 값은 design/html/home_*_{sunny|cloudy}.html의 SVG 그대로다. null이면 --bg 단색(불러오기 실패).
 */
export function WeatherBackground({ condition }: { condition: WeatherCondition | null }) {
  const id = useId().replace(/:/g, "");
  if (!condition) return null;

  if (condition === "sunny") {
    return (
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 h-[844px] w-full"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMin slice"
        aria-hidden
      >
        <defs>
          <linearGradient id={`sk${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#CFE6F7" />
            <stop offset=".28" stopColor="#E4F0F8" />
            <stop offset=".5" stopColor="#F7F6F3" />
            <stop offset="1" stopColor="#F7F6F3" />
          </linearGradient>
          <radialGradient id={`sun${id}`} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFF7DC" stopOpacity=".95" />
            <stop offset="1" stopColor="#FFF7DC" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="390" height="844" fill={`url(#sk${id})`} />
        <circle cx="330" cy="70" r="150" fill={`url(#sun${id})`} />
        <Cloud x={60} y={150} scale={0.55} fill="#fff" opacity={0.9} />
        <Cloud x={340} y={230} scale={0.45} fill="#fff" opacity={0.8} />
      </svg>
    );
  }

  // 흐림: 배경 레이어 전체를 8px 흐리게. 가장자리가 비치지 않게 20px씩 넓게 그린다.
  return (
    <div className="pointer-events-none absolute -top-5 -right-5 -left-5 h-[884px] blur-[8px]" aria-hidden>
      <svg className="h-full w-full" viewBox="0 0 430 884" preserveAspectRatio="xMidYMin slice">
        <defs>
          <linearGradient id={`sk${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C7CBD0" />
            <stop offset=".3" stopColor="#DCDDDD" />
            <stop offset=".52" stopColor="#F7F6F3" />
            <stop offset="1" stopColor="#F7F6F3" />
          </linearGradient>
        </defs>
        <rect width="430" height="884" fill={`url(#sk${id})`} />
        <Cloud x={80} y={130} scale={1.1} fill="#AEB4BB" opacity={0.7} />
        <Cloud x={350} y={110} scale={1.2} fill="#A5ACB4" opacity={0.65} />
        <Cloud x={230} y={230} scale={1.0} fill="#C3C7CC" opacity={0.7} />
      </svg>
    </div>
  );
}
