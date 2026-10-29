/** 목업용 iOS 상태바. 배경은 투명해서 홈 날씨 배경 위에도 그대로 보인다. */
export function StatusBar() {
  return (
    <div
      className="status-bar pointer-events-none absolute inset-x-0 top-0 z-50 flex h-[38px] items-end justify-between px-[26px] pb-1 text-sm font-semibold text-ink"
      aria-hidden
    >
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        <span className="flex h-[11px] items-end gap-0.5">
          {[4, 6, 8, 11].map((h) => (
            <i key={h} className="block w-[3px] rounded-[1px] bg-ink" style={{ height: h }} />
          ))}
        </span>
        <span className="relative h-[11px] w-6 rounded-[3.5px] border-[1.4px] border-ink opacity-85">
          <span className="absolute top-[1.5px] bottom-[1.5px] left-[1.5px] w-[14px] rounded-[1.5px] bg-ink" />
        </span>
      </span>
    </div>
  );
}
