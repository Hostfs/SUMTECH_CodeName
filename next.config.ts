import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 없이 정적 파일로 배포한다. 데이터는 모두 브라우저(localStorage)에 있다.
  output: "export",
  // 아이폰 프레임 모서리를 가리지 않게 개발 표시(N 배지)를 끈다
  devIndicators: false,
};

export default nextConfig;
