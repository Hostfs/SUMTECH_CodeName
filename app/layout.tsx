import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { DataProvider } from "@/components/DataProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { PhoneFrame } from "@/components/layout/PhoneFrame";
import { phoneZoomScript } from "@/lib/phone";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "내 옷장",
  description: "내 옷과 보관 위치를 한곳에서 관리해요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F6F3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-season은 인라인 스크립트가 첫 렌더 전에 정한다 (깜빡임 방지)
    <html lang="ko" data-season="autumn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript + phoneZoomScript }} />
      </head>
      <body>
        <ThemeProvider>
          <DataProvider>
            <ToastProvider>
              <PhoneFrame>{children}</PhoneFrame>
            </ToastProvider>
          </DataProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
