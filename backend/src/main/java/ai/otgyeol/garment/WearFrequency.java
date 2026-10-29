package ai.otgyeol.garment;

/** 사용자가 지정한 자주 입는 정도. 배치 추천에 쓴다. */
public enum WearFrequency {
    HIGH("자주"), MEDIUM("보통"), LOW("가끔");

    public final String label;

    WearFrequency(String label) {
        this.label = label;
    }
}
