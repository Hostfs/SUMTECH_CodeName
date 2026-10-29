package ai.otgyeol.image;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 옷의 대표 이미지. 그 옷에 연결된 이미지만 고를 수 있다(복합 FK). */
@Entity
@Table(name = "garment_cover_images")
public class GarmentCoverImage {

    @Id
    public Long garmentId;

    public Long imageId;

    protected GarmentCoverImage() {
    }

    public GarmentCoverImage(Long garmentId, Long imageId) {
        this.garmentId = garmentId;
        this.imageId = imageId;
    }
}
