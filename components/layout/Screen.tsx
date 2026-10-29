/**
 * 한 화면의 스크롤 영역. 위로는 상태바 높이, 아래로는 탭 바 높이만큼 비운다.
 * background를 넘기면 화면 맨 위(상태바 뒤)부터 깔린다 (홈 날씨 배경용).
 */
export function Screen({
  children,
  withTabBar = false,
  background,
}: {
  children: React.ReactNode;
  withTabBar?: boolean;
  background?: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 overflow-clip bg-bg">
      {background}
      <main
        className="no-scrollbar @container relative h-full overflow-y-auto overscroll-contain pt-[var(--status-h)]"
        style={withTabBar ? { paddingBottom: "var(--tabbar-h)" } : undefined}
      >
        {children}
      </main>
    </div>
  );
}
