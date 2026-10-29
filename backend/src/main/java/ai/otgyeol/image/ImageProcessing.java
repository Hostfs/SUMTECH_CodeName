package ai.otgyeol.image;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 배경 제거·정렬 처리. resultImageId가 null이면 처리에 실패했고 원본을 그대로 쓴다. */
@Entity
@Table(name = "image_processings")
public class ImageProcessing {

    @Id
    public Long sourceImageId;

    public Long resultImageId;
    public Instant processedAt = Instant.now();
}
