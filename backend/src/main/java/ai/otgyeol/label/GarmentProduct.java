package ai.otgyeol.label;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 사용자가 '이 제품 선택'으로 확정한 후보. 옷 한 벌에 많아야 하나. */
@Entity
@Table(name = "garment_products")
public class GarmentProduct {

    @Id
    public Long garmentId;

    public Long candidateId;
    public Instant confirmedAt = Instant.now();

    protected GarmentProduct() {
    }

    public GarmentProduct(Long garmentId, Long candidateId) {
        this.garmentId = garmentId;
        this.candidateId = candidateId;
    }
}
