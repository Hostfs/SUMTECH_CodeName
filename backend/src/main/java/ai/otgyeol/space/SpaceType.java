package ai.otgyeol.space;

public enum SpaceType {
    HANG("걸기"), FOLD("접기"), LONG_TERM("장기보관"),
    /** 통째로 옮기는 상자(R11). 집 안에 있지만 꺼내야 입을 수 있다. */
    BOX("박스"),
    /** 본가처럼 집 밖에 있는 곳(R11). 옷장 지도의 배치 추천 대상이 아니다. */
    OFFSITE("집 밖");

    public final String label;

    SpaceType(String label) {
        this.label = label;
    }
}
