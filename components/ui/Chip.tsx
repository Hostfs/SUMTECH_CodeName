/** 알약형 칩. 기본은 흰 바탕 + 테두리, 선택은 primary 바탕 (design-system 3절) */
export function Chip({
  selected,
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-[13px] text-sm whitespace-nowrap disabled:opacity-40 " +
        (selected ? "border-primary bg-primary font-semibold text-on " : "border-line bg-card text-ink ") +
        className
      }
      {...rest}
    >
      {children}
    </button>
  );
}
