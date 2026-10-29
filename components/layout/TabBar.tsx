"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 아이콘은 design/html 목업의 SVG를 그대로 옮겼다 (stroke 1.6).
const Icon = ({ children, size = 24, stroke = 1.6 }: { children: React.ReactNode; size?: number; stroke?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
    aria-hidden
  >
    {children}
  </svg>
);

const TABS = [
  {
    href: "/",
    label: "홈",
    icon: <path d="M4 11 L12 4 L20 11 V20 H14.5 V14 H9.5 V20 H4 Z" />,
  },
  {
    href: "/closet",
    label: "내 옷장",
    icon: (
      <>
        <path d="M12 9V7.8a2.3 2.3 0 1 0-2.3-2.3" />
        <path d="M12 9 L20.6 15.2 a1 1 0 0 1-.6 1.8 H4 a1 1 0 0 1-.6-1.8 Z" />
      </>
    ),
  },
  null, // 가운데 + 버튼
  {
    href: "/storage",
    label: "보관함",
    icon: (
      <>
        <path d="M4 9h16v10H4z" />
        <path d="M3 5.5h18V9H3z" />
        <path d="M10 13h4" />
      </>
    ),
  },
  {
    href: "/my",
    label: "마이",
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M5 20 C5.5 15.5 8.5 14 12 14 C15.5 14 18.5 15.5 19 20" />
      </>
    ),
  },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-40 flex h-[var(--tabbar-h)] items-start justify-around border-t border-line bg-white px-1.5 pt-2"
      aria-label="주요 메뉴"
    >
      {TABS.map((tab) =>
        tab === null ? (
          <Link
            key="add"
            href="/closet/new"
            aria-label="옷 등록"
            className="-mt-0.5 flex size-[52px] items-center justify-center rounded-full bg-primary text-on shadow-[0_0_0_4px_#fff]"
          >
            <Icon size={26} stroke={1.9}>
              <path d="M12 5v14M5 12h14" />
            </Icon>
          </Link>
        ) : (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive(pathname, tab.href) ? "page" : undefined}
            className="flex w-[62px] flex-col items-center gap-[3px] pt-1 text-tab text-sub aria-[current=page]:font-semibold aria-[current=page]:text-deep"
          >
            <Icon>{tab.icon}</Icon>
            <span>{tab.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
