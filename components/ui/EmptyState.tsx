/**
 * 빈 상태·안내 상자: 점선 테두리 + 반투명 흰 바탕 (design-system 4절 '빈 안내 박스').
 * 문구는 문장마다 <br />로 나눠서 넘기고, 버튼은 action으로 넘긴다.
 */
export function EmptyState({
  children,
  action,
  className = "mx-4 mt-6",
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "flex flex-col items-center rounded-card border border-dashed border-dash bg-white/60 px-5 py-10 text-center text-sm leading-relaxed text-sub " +
        className
      }
    >
      <p>{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
