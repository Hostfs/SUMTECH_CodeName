package ai.otgyeol.garment;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import ai.otgyeol.space.SpaceType;

/** 박스·집 밖 아래에 만든 공간의 위치 종류. DB 없이 돈다. */
class LocationKindRulesTest {

    @Test
    void 박스와_집_밖_아래_공간은_그_유형을_따른다() {
        // 1 본가(집 밖) → 2 안방 옷장(걸기) → 3 위 칸(접기), 4 여름 박스 → 5 칸막이(접기), 6 옷장 A(걸기) → 7 왼쪽 행거(걸기)
        Map<Long, SpaceType> own = Map.of(1L, SpaceType.OFFSITE, 2L, SpaceType.HANG, 3L, SpaceType.FOLD,
                4L, SpaceType.BOX, 5L, SpaceType.FOLD, 6L, SpaceType.HANG, 7L, SpaceType.HANG);
        Map<Long, Long> parentOf = Map.of(2L, 1L, 3L, 2L, 5L, 4L, 7L, 6L);

        Map<Long, SpaceType> types = ClosetContext.Loader.awayAware(own, parentOf);

        assertThat(types.get(2L)).isEqualTo(SpaceType.OFFSITE);
        assertThat(types.get(3L)).isEqualTo(SpaceType.OFFSITE);
        assertThat(types.get(5L)).isEqualTo(SpaceType.BOX);
        assertThat(types.get(7L)).isEqualTo(SpaceType.HANG);
    }
}
