// 선형 아이콘. 목업(design/html)에 있는 SVG 경로를 그대로 옮겼다 (stroke 1.6~1.7).

type IconProps = { size?: number; stroke?: number; className?: string };

export function Icon({
  children,
  size = 24,
  stroke = 1.6,
  className,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Icon size={20} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16 L20.5 20.5" />
  </Icon>
);

export const FilterIcon = (p: IconProps) => (
  <Icon size={20} {...p}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon size={18} {...p}>
    <path d="M6 9 L12 15 L18 9" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon size={18} {...p}>
    <path d="M9 6 L15 12 L9 18" />
  </Icon>
);

export const PinIcon = (p: IconProps) => (
  <Icon size={13} stroke={1.7} {...p}>
    <path d="M12 21s6-5.6 6-10.5A6 6 0 0 0 6 10.5C6 15.4 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2.2" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon size={15} stroke={2.4} {...p}>
    <path d="M6 12.5 L10.5 17 L18 8" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon size={20} {...p}>
    <path d="M6 6 L18 18 M18 6 L6 18" />
  </Icon>
);

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11 L12 4 L20 11 V20 H14.5 V14 H9.5 V20 H4 Z" />
  </Icon>
);

export const HangerIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 9V7.8a2.3 2.3 0 1 0-2.3-2.3" />
    <path d="M12 9 L20.6 15.2 a1 1 0 0 1-.6 1.8 H4 a1 1 0 0 1-.6-1.8 Z" />
  </Icon>
);

export const BoxIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9h16v10H4z" />
    <path d="M3 5.5h18V9H3z" />
    <path d="M10 13h4" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 20 C5.5 15.5 8.5 14 12 14 C15.5 14 18.5 15.5 19 20" />
  </Icon>
);

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5 L8 12 L15 19" />
  </Icon>
);

export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1.1" />
    <circle cx="12" cy="12" r="1.1" />
    <circle cx="19" cy="12" r="1.1" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon size={18} {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
    <circle cx="12" cy="13" r="3.2" />
  </Icon>
);
