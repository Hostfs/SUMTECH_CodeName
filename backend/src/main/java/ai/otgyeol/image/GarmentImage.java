package ai.otgyeol.image;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 이미지 → 옷 연결. 이미지는 많아야 한 벌에 속한다. */
@Entity
@Table(name = "garment_images")
public class GarmentImage {

    @Id
    public Long imageId;

    public Long garmentId;

    protected GarmentImage() {
    }

    public GarmentImage(Long imageId, Long garmentId) {
        this.imageId = imageId;
        this.garmentId = garmentId;
    }
}
