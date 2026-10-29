package ai.otgyeol.common;

import java.time.LocalDate;
import java.time.ZoneId;

import ai.otgyeol.garment.Season;

/** 회수 예정·기한 지남은 서비스 대상 지역(한국) 날짜로 계산한다. */
public final class Dates {

    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

    private Dates() {
    }

    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    public static Season currentSeason() {
        int month = today().getMonthValue();
        if (month >= 3 && month <= 5) {
            return Season.SPRING;
        }
        if (month >= 6 && month <= 8) {
            return Season.SUMMER;
        }
        if (month >= 9 && month <= 11) {
            return Season.AUTUMN;
        }
        return Season.WINTER;
    }
}
