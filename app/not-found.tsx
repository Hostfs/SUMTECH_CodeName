import Link from "next/link";
import { Screen } from "@/components/layout/Screen";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        className="mx-4 mt-24"
        action={
          <Link href="/" className={buttonClass()}>
            홈으로
          </Link>
        }
      >
        페이지를 찾지 못했어요.
        <br />
        주소를 다시 확인해 주세요.
      </EmptyState>
    </Screen>
  );
}
