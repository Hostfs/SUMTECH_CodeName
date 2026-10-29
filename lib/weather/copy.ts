import type { Season } from "../theme";
import type { WeatherCondition } from "./types";

/**
 * 홈 문구 표 (계절 × 날씨). docs/screens.md 1절 표를 그대로 옮겼다. 바꾸려면 문서도 같이 고친다.
 * 각 항목은 문장 단위로 나눈 두 줄이다.
 */
export const HOME_COPY: Record<Season, Record<WeatherCondition, { greeting: [string, string]; tip: [string, string] }>> = {
  spring: {
    sunny: {
      greeting: ["따뜻한 봄날이에요.", "오늘은 어떤 옷을 찾아볼까요?"],
      tip: ["아침저녁은 쌀쌀해요.", "가벼운 카디건을 챙겨 보세요."],
    },
    cloudy: {
      greeting: ["구름이 많은 봄날이에요.", "얇은 겉옷부터 찾아볼까요?"],
      tip: ["오후에 비가 올 수 있어요.", "우산을 꼭 챙겨 주세요."],
    },
  },
  summer: {
    sunny: {
      greeting: ["햇살이 강한 여름날이에요.", "시원한 옷부터 찾아볼까요?"],
      tip: ["한낮에 많이 더워요.", "통기성 좋은 옷을 골라 보세요."],
    },
    cloudy: {
      greeting: ["흐리고 습한 날이에요.", "가벼운 옷부터 찾아볼까요?"],
      tip: ["소나기가 올 수 있어요.", "가벼운 옷을 골라 보세요."],
    },
  },
  autumn: {
    sunny: {
      greeting: ["맑은 가을날이에요.", "오늘은 어떤 옷을 찾아볼까요?"],
      tip: ["일교차가 커요.", "얇은 아우터를 챙겨 보세요."],
    },
    cloudy: {
      greeting: ["하늘이 흐린 날이에요.", "포근한 옷부터 찾아볼까요?"],
      tip: ["저녁에 비가 올 수 있어요.", "가벼운 아우터를 챙겨 보세요."],
    },
  },
  winter: {
    sunny: {
      greeting: ["맑지만 추운 겨울날이에요.", "따뜻한 옷부터 찾아볼까요?"],
      tip: ["바람이 차가워요.", "두꺼운 아우터를 챙겨 보세요."],
    },
    cloudy: {
      greeting: ["하늘이 흐린 겨울날이에요.", "포근한 니트부터 찾아볼까요?"],
      tip: ["밤에 눈이 올 수 있어요.", "미끄럼에 주의하세요."],
    },
  },
};

/** 날씨를 가져오지 못했을 때 (목업 없음, screens.md 1절) */
export const WEATHER_ERROR: [string, string] = ["날씨 정보를 불러오지 못했어요.", "잠시 후 다시 시도해 주세요."];
