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

export const BellIcon = (p: IconProps) => (
  <Icon size={20} {...p}>
    <path d="M6 16 V11 A6 6 0 0 1 18 11 V16 L19.5 18 H4.5 Z" />
    <path d="M10 20.5 a2 2 0 0 0 4 0" />
  </Icon>
);

/** 코디(상의) 아이콘 */
export const ShirtIcon = (p: IconProps) => (
  <Icon size={16} {...p}>
    <path d="M8.5 4 L4 7 L6 10.5 L8 9.5 V20 H16 V9.5 L18 10.5 L20 7 L15.5 4 Q12 7 8.5 4Z" />
  </Icon>
);

// ── 날씨 아이콘 (목업과 같은 경로) ──

export const SunIcon = (p: IconProps) => (
  <Icon size={22} stroke={1.5} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </Icon>
);

export const PartlyCloudyIcon = (p: IconProps) => (
  <Icon size={22} stroke={1.5} {...p}>
    <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
  </Icon>
);

export const CloudIcon = (p: IconProps) => (
  <Icon size={22} stroke={1.5} {...p}>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </Icon>
);

export const RainIcon = (p: IconProps) => (
  <Icon size={22} stroke={1.5} {...p}>
    <path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24M16 14v6M8 14v6M12 16v6" />
  </Icon>
);

export const SnowIcon = (p: IconProps) => (
  <Icon size={22} stroke={1.5} {...p}>
    <path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24" />
    <path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon size={22} stroke={1.5} {...p}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </Icon>
);

export const SmallCloseIcon = (p: IconProps) => (
  <Icon size={13} stroke={2} {...p}>
    <path d="M7 7 L17 17 M17 7 L7 17" />
  </Icon>
);

export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </Icon>
);

export const PaletteIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <path d="M12 4a8 8 0 1 0 0 16c1.2 0 1.6-.8 1.2-1.6-.5-1 .1-2 1.3-2H17a3 3 0 0 0 3-3C20 8 16.4 4 12 4z" />
    <circle cx="8.5" cy="11" r="1" />
    <circle cx="12" cy="8" r="1" />
    <circle cx="15.5" cy="10" r="1" />
  </Icon>
);

export const HelpIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 1.8-2.2 3.2M12 16.6v.1" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
  </Icon>
);

export const BodyIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <circle cx="12" cy="5" r="2.2" />
    <path d="M12 8.5v6.5M7 10.5 12 8.5l5 2M9.5 21 12 15l2.5 6" />
  </Icon>
);
