package ai.otgyeol.garment;

/**
 * 옷이 지금 어디에 있는지의 큰 구분(R04 '집 밖/박스' 보기, R11). 저장하지 않고 상태와 확정 위치의 공간 유형에서 계산한다.
 * 확정 위치가 있어도 세탁·수선 중이면 집에 없고, 회수 후 확인 전이면 미배치로 본다.
 */
public enum LocationKind {
    HOME("집 안"), BOX("박스 속"), OFFSITE("집 밖"), CARE("세탁·수선 맡김"), UNPLACED("미배치");

    public final String label;

    LocationKind(String label) {
        this.label = label;
    }
}
