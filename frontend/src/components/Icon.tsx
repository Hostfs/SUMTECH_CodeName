import type { ReactNode } from 'react';

const PATHS = {
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  filter: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  more: <><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>,
  home: <path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1Z" />,
  hanger: <path d="M9.5 6.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.8M12 11l-8.6 6.2c-.8.6-.4 1.8.6 1.8h16c1 0 1.4-1.2.6-1.8Z" />,
  shirt: <path d="M8.5 3.5L3 6.5l2 4 2-1V20.5h10V9.5l2 1 2-4-5.5-3c-.5 1.5-1.9 2.5-3.5 2.5S9 5 8.5 3.5Z" />,
  box: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M4.5 9v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9M10 13h4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1.3-3.6 4.2-5.5 7.5-5.5s6.2 1.9 7.5 5.5" /></>,
  bell: <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15ZM10 21h4" />,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.9-.6-1.2-.6-2 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7.5" r="1" /><circle cx="14.5" cy="7.5" r="1" /></>,
  cloudSun: <><path d="M7 19a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18 10.5a4 4 0 0 1-.5 8.5Z" /><path d="M9 4.5v1.2M4.2 6.5l.9.9M15 5.2l-.9.9" /></>,
  logout: <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9.5 16.5L5 12l4.5-4.5M5 12h10" />,
  camera: <><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><circle cx="12" cy="12.5" r="3.5" /></>,
  drop: <path d="M12 3.5S5.5 10.2 5.5 14.3a6.5 6.5 0 0 0 13 0C18.5 10.2 12 3.5 12 3.5Z" />,
  scissors: <><circle cx="6" cy="6.5" r="2.5" /><circle cx="6" cy="17.5" r="2.5" /><path d="M8 8l12 9M8 16L20 7" /></>,
  trash: <path d="M4 7h16M10 7V4h4v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16Z" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  tag: <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7L21 12.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0Z" /><circle cx="8" cy="8" r="1.4" /></>,
  upload: <><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V13M12 16.5v.01" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5" /></>,
  sparkle: <path d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5 9.8 8.3z" fill="currentColor" stroke="none" />,
  sun: <><circle cx="12" cy="12" r="4.2" fill="currentColor" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" fill="currentColor" stroke="none" />,
  cloud: <path d="M7 19a5 5 0 0 1-.6-9.96A7 7 0 0 1 19.8 8.1 5.5 5.5 0 0 1 19.5 19Z" fill="currentColor" stroke="none" />,
  rain: <><path d="M7 15a5 5 0 0 1-.6-9.96A7 7 0 0 1 19.8 4.1 5.5 5.5 0 0 1 19.5 15Z" fill="currentColor" stroke="none" /><path d="M8 18l-1.5 4M13 18l-1.5 4M18 18l-1.5 4" /></>,
  snow: <><path d="M7 14a5 5 0 0 1-.6-9.96A7 7 0 0 1 19.8 3.1 5.5 5.5 0 0 1 19.5 14Z" fill="currentColor" stroke="none" /><g fill="currentColor" stroke="none"><circle cx="8" cy="19" r="1.6" /><circle cx="13" cy="22" r="1.6" /><circle cx="18" cy="19" r="1.6" /></g></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

interface Props {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
}

export function Icon({ name, size = 20, stroke = 1.8, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
