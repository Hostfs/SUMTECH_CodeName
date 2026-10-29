"use client";

import { useEffect } from "react";
import { applyPhoneZoom } from "@/lib/phone";
import { StatusBar } from "./StatusBar";

/** 넓은 화면에서는 아이폰 프레임, 실제 폰에서는 전체 화면으로 보여 준다 (globals.css 참고). */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyPhoneZoom();
    window.addEventListener("resize", applyPhoneZoom);
    return () => window.removeEventListener("resize", applyPhoneZoom);
  }, []);

  return (
    <div className="phone-stage">
      <div className="phone-frame">
        <div className="phone-screen">
          {children}
          <StatusBar />
          <div className="phone-island" aria-hidden />
          <div className="phone-home-indicator" aria-hidden />
        </div>
      </div>
    </div>
  );
}
