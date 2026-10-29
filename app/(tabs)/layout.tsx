import { TabBar } from "@/components/layout/TabBar";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
