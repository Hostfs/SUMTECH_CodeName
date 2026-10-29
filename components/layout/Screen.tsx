/**
 * 한 화면의 스크롤 영역. 위로는 상태바 높이, 아래로는 탭 바(또는 하단 고정 바) 높이만큼 비운다.
 * background를 넘기면 화면 맨 위(상태바 뒤)부터 깔린다 (홈 날씨 배경용).
 * bottomBar는 스크롤 밖 아래에 고정된다 (상세·등록 화면의 버튼 바).
 */
export function Screen({
  children,
  withTabBar = false,
  background,
  bottomBar,
}: {
  children: React.ReactNode;
  withTabBar?: boolean;
  background?: React.ReactNode;
  bottomBar?: React.ReactNode;
}) {
  const inset = withTabBar ? "var(--tabbar-h)" : bottomBar ? "var(--botbar-h)" : undefined;
  return (
    <div className="absolute inset-0 overflow-clip bg-bg">
      {background}
      <main
        className="no-scrollbar @container relative h-full overflow-y-auto overscroll-contain pt-[var(--status-h)]"
        style={inset ? { paddingBottom: inset } : undefined}
      >
        {children}
      </main>
      {bottomBar && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex h-[var(--botbar-h)] items-start gap-2 border-t border-line bg-white px-4 pt-3.5">
          {bottomBar}
        </div>
      )}
    </div>
  );
}
