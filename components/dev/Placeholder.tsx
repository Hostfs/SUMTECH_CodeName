import Link from "next/link";
import { Screen } from "@/components/layout/Screen";

/** 1단계 임시 화면. 각 단계에서 실제 화면으로 바꾼다. */
export function Placeholder({ title, withTabBar = true }: { title: string; withTabBar?: boolean }) {
  return (
    <Screen withTabBar={withTabBar}>
      <div className="flex h-12 items-center px-5 pt-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
      </div>
      <p className="px-5 pt-2 text-sm text-sub">
        이 화면은 다음 단계에서 만들어요.
        <br />
        <Link href="/dev/theme" className="font-semibold text-deep">
          테마 확인 화면 ›
        </Link>
      </p>
    </Screen>
  );
}
