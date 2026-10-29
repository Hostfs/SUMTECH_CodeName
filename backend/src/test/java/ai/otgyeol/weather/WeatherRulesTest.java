package ai.otgyeol.weather;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import ai.otgyeol.garment.Season;

/** 기상청 격자 변환과 기온 → 계절 기준표. DB·외부 호출 없이 돈다. */
class WeatherRulesTest {

    @Test
    void 위경도를_기상청_격자로_바꾼다() {
        assertThat(KmaGrid.of(37.5665, 126.9780)).isEqualTo(new KmaGrid.Point(60, 127)); // 서울시청
        assertThat(KmaGrid.of(35.1796, 129.0756)).isEqualTo(new KmaGrid.Point(98, 76)); // 부산시청
        assertThat(KmaGrid.of(33.4996, 126.5312)).isEqualTo(new KmaGrid.Point(53, 38)); // 제주시
    }

    @Test
    void 기온에_맞는_계절을_고른다() {
        assertThat(WeatherController.seasonsFor(27.0)).isEqualTo(List.of(Season.SUMMER));
        assertThat(WeatherController.seasonsFor(18.0)).isEqualTo(List.of(Season.SPRING, Season.AUTUMN));
        assertThat(WeatherController.seasonsFor(8.0)).isEqualTo(List.of(Season.AUTUMN, Season.WINTER));
        assertThat(WeatherController.seasonsFor(-3.0)).isEqualTo(List.of(Season.WINTER));
    }
}
