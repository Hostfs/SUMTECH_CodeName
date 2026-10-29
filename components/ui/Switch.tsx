/** 켜고 끄는 스위치 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative h-[30px] w-[50px] flex-none rounded-full transition-colors disabled:opacity-40 " +
        (checked ? "bg-primary" : "bg-[#D9D6CF]")
      }
    >
      <span
        className={
          "absolute top-[3px] left-[3px] size-6 rounded-full bg-white transition-transform " +
          (checked ? "translate-x-5" : "translate-x-0")
        }
      />
    </button>
  );
}
