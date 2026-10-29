export type Season = "spring" | "summer" | "autumn" | "winter";
export type ThemeSetting = "auto" | Season;

export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

export const SEASON_LABEL: Record<Season, string> = {
  spring: "봄",
  summer: "여름",
  autumn: "가을",
  winter: "겨울",
};

/** 각 계절의 포인트 색. 테마 선택 화면의 색 미리보기 점에만 쓴다. */
export const SEASON_PRIMARY: Record<Season, string> = {
  spring: "#F7B1B0",
  summer: "#2EC4B6",
  autumn: "#A47148",
  winter: "#134074",
};

export const THEME_STORAGE_KEY = "closet.theme";

/** 한국 기준 월로 계절을 정한다: 3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울 */
export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function seoulMonth(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", month: "numeric" }).format(date),
  );
}

export function resolveSeason(setting: ThemeSetting): Season {
  return setting === "auto" ? seasonOfMonth(seoulMonth()) : setting;
}

/**
 * 첫 렌더 전에 <html data-season>을 정하는 인라인 스크립트.
 * 위 함수들과 같은 규칙을 따른다. 바꿀 때 함께 고칠 것.
 */
export const themeInitScript = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"auto";
if(["auto","spring","summer","autumn","winter"].indexOf(s)<0)s="auto";
if(s==="auto"){var m=+new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",month:"numeric"}).format(new Date());
s=m>=3&&m<=5?"spring":m>=6&&m<=8?"summer":m>=9&&m<=11?"autumn":"winter";}
document.documentElement.setAttribute("data-season",s);}catch(e){}})();`;
