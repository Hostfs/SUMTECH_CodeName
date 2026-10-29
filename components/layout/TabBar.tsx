"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxIcon, HangerIcon, HomeIcon, Icon, ShirtIcon } from "@/components/icons";

const TABS = [
  { href: "/", label: "홈", Icon: HomeIcon },
  { href: "/closet", label: "내 옷장", Icon: HangerIcon },
  null, // 가운데 + 버튼
  { href: "/storage", label: "보관함", Icon: BoxIcon },
  { href: "/outfits", label: "코디", Icon: ShirtIcon },
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
            <tab.Icon size={24} />
            <span>{tab.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
