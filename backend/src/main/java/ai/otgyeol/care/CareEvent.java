package ai.otgyeol.care;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import ai.otgyeol.garment.GarmentStatus;

/**
 * 세탁·수선 기록. completedAt이 채워지면 진행 중 목록에서 빠지고 이력으로 남는다.
 * 옷 한 벌에 진행 중인 기록은 하나다(DB의 uk_ce_one_ongoing이 최종 보장).
 */
@Entity
@Table(name = "care_events")
public class CareEvent {

    public enum CareType {
        WASH("세탁", GarmentStatus.WASHING), REPAIR("수선", GarmentStatus.REPAIRING);

        public final String label;
        /** 맡기면 옷이 보이는 상태(care_types.garment_status_code) */
        public final GarmentStatus garmentStatus;

        CareType(String label, GarmentStatus garmentStatus) {
            this.label = label;
            this.garmentStatus = garmentStatus;
        }
    }

    public enum Place {
        HOME("자택"), SHOP("업체");

        public final String label;

        Place(String label) {
            this.label = label;
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long garmentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "care_type_code")
    public CareType careType;

    @Enumerated(EnumType.STRING)
    @Column(name = "place_code")
    public Place place;

    public String shopName;
    public String description;
    public LocalDate droppedOn;
    public LocalDate dueOn;
    public Instant completedAt;
    public Instant createdAt = Instant.now();

    public boolean isOpen() {
        return completedAt == null;
    }
}
