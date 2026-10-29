import { Button } from "@/components/ui/Button";

/** 선택 모드 하단 액션 바: 'n개 선택됨 · 선택 해제 · [위치 변경]' (closet_*.html .actionbar) */
export function SelectionBar({
  count,
  onClear,
  onMove,
  aboveTabBar = true,
}: {
  count: number;
  onClear: () => void;
  onMove: () => void;
  /** 탭 바가 없는 화면에서는 화면 아래에 붙인다 */
  aboveTabBar?: boolean;
}) {
  return (
    <div
      className={
        "absolute inset-x-4 z-30 flex h-[60px] items-center justify-between rounded-card-lg border border-line bg-card pr-2.5 pl-4 " +
        (aboveTabBar ? "bottom-[calc(var(--tabbar-h)+10px)]" : "bottom-[34px]")
      }
    >
      <span className="text-[15px] font-semibold">{count}개 선택됨</span>
      <span className="flex items-center gap-1.5">
        <Button variant="ghost" disabled={count === 0} onClick={onClear}>
          선택 해제
        </Button>
        <Button disabled={count === 0} onClick={onMove}>
          위치 변경
        </Button>
      </span>
    </div>
  );
}
