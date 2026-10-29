"use client";

import { useRouter } from "next/navigation";
import { useData } from "@/components/DataProvider";
import { GarmentForm } from "@/components/garment/GarmentForm";
import { useToast } from "@/components/ui/Toast";

export default function NewGarmentPage() {
  const router = useRouter();
  const toast = useToast();
  const { createGarment } = useData();

  return (
    <GarmentForm
      title="옷 등록"
      onCancel={() => (window.history.length > 1 ? router.back() : router.replace("/closet"))}
      onSubmit={async (input) => {
        const g = await createGarment(input);
        // 내 옷장으로 가서 새 카드를 강조한다
        router.replace(`/closet?new=${g.id}`);
        toast("등록했어요");
      }}
    />
  );
}
