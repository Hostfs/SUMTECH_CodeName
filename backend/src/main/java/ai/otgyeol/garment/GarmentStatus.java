package ai.otgyeol.garment;

/**
 * 의류 상태(garment_statuses 도메인 테이블과 같은 값).
 * garments.status_code에는 사용자가 정하는 집 안 상태(STORED, PENDING, WASH_WAITING)만 저장한다.
 * 세탁 중·수선 중은 진행 중인 세탁·수선 기록에서, 회수 완료·위치 미확인은 회수 시각과 위치 확정 시각에서 계산한다.
 */
public enum GarmentStatus {
    STORED("보관 중"),
    PENDING("착용·보관 전"),
    WASH_WAITING("세탁 대기"),
    WASHING("세탁 중"),
    REPAIRING("수선 중"),
    RETURNED_UNPLACED("회수 완료·위치 미확인");

    public final String label;

    GarmentStatus(String label) {
        this.label = label;
    }

    /** 사용자가 직접 정해 저장하는 상태인지. */
    public boolean isHomeStatus() {
        return this == STORED || this == PENDING || this == WASH_WAITING;
    }

    /** 실물이 집에 없는 상태. care_types.garment_status_code에 나오는 값이다. */
    public boolean isAway() {
        return this == WASHING || this == REPAIRING;
    }
}
