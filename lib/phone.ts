// 아이폰 미리보기 프레임 바깥 크기(화면 390×844 + 테두리 13px×2 + 링 3px×2)와 무대 여백
const FRAME_W = 390 + 32;
const FRAME_H = 844 + 32;
const STAGE_PAD = 32;

/** 창이 프레임보다 작으면 프레임 전체를 줄여서 한눈에 보이게 한다. */
export function applyPhoneZoom() {
  const z = Math.min(1, (innerHeight - STAGE_PAD) / FRAME_H, (innerWidth - STAGE_PAD) / FRAME_W);
  document.documentElement.style.setProperty("--phone-zoom", String(Math.max(0.4, z)));
}

/** 첫 렌더 전에 실행하는 같은 계산. applyPhoneZoom과 함께 고칠 것. */
export const phoneZoomScript = `(function(){try{var z=Math.min(1,(innerHeight-${STAGE_PAD})/${FRAME_H},(innerWidth-${STAGE_PAD})/${FRAME_W});document.documentElement.style.setProperty("--phone-zoom",String(Math.max(.4,z)));}catch(e){}})();`;
