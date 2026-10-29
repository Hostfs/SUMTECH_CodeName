package ai.otgyeol.space;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 확정된 보관 위치. '배치 완료'나 '재배치 확인'으로만 바뀐다. 미배치 옷은 행이 없다. */
@Entity
@Table(name = "garment_placements")
public class GarmentPlacement {

    @Id
    public Long garmentId;

    public Long spaceId;
    public Instant placedAt;

    protected GarmentPlacement() {
    }

    public GarmentPlacement(Long garmentId, Long spaceId, Instant placedAt) {
        this.garmentId = garmentId;
        this.spaceId = spaceId;
        this.placedAt = placedAt;
    }
}
