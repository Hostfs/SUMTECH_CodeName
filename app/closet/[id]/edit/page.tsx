"use client";

import { useParams, useRouter } from "next/navigation";
import { useData } from "@/components/DataProvider";
import { GarmentForm } from "@/components/garment/GarmentForm";
import { Screen } from "@/components/layout/Screen";
import { TopBar } from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/Toast";

export default function EditGarmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { ready, garments, updateGarment } = useData();
  const g = garments.find((x) => x.id === id);

  if (!g) {
    return (
      <Screen>
        <TopBar title="옷 정보 수정" />
        {ready && <p className="px-5 pt-10 text-center text-sm text-sub">옷 정보를 찾지 못했어요.</p>}
      </Screen>
    );
  }

  // 보통은 상세에서 들어오므로 뒤로 가서 상세로 돌아간다 (기록이 쌓이지 않게)
  const toDetail = () => (window.history.length > 1 ? router.back() : router.replace(`/closet/${g.id}`));

  return (
    // 저장된 데이터를 읽은 뒤 폼을 다시 채우도록 key를 둔다
    <GarmentForm
      key={`${g.id}-${ready}`}
      title="옷 정보 수정"
      initial={g}
      onCancel={toDetail}
      onSubmit={async (input) => {
        await updateGarment(g.id, input);
        toDetail();
        toast("수정했어요");
      }}
    />
  );
}
