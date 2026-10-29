package ai.otgyeol.label;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 택 판독 → 그 판독으로 등록된 옷. */
@Entity
@Table(name = "garment_label_extractions")
public class GarmentLabelExtraction {

    @Id
    public Long extractionId;

    public Long garmentId;

    protected GarmentLabelExtraction() {
    }

    public GarmentLabelExtraction(Long extractionId, Long garmentId) {
        this.extractionId = extractionId;
        this.garmentId = garmentId;
    }
}
