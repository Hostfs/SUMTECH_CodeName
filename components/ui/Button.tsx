type Variant = "primary" | "outline" | "ghost";
type Size = "md" | "lg" | "sm";

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-on",
  outline: "border border-line bg-card text-ink",
  ghost: "text-sub font-medium px-3",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-[18px] text-[15px]",
  lg: "h-[50px] px-5 text-base",
};

/** 링크를 버튼처럼 보이게 할 때도 같은 클래스를 쓴다 */
export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return `flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap disabled:opacity-40 ${SIZE[size]} ${VARIANT[variant]}`;
}

/** 알약형 버튼. 높이 44(일반) / 50(하단 고정) / 36(작은) */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={`${buttonClass(variant, size)} ${className}`}
      {...rest}
    />
  );
}
