package ai.otgyeol.image;

import java.time.Instant;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

/** 업로드하거나 가져온 이미지(images). 종류는 저장하지 않고 연결 테이블에서 계산한다(ImageKind). */
@Entity
@Table(name = "images")
public class ImageAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long userId;
    public String contentType;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(columnDefinition = "LONGBLOB")
    public byte[] data;

    /** 제품 페이지에서 가져온 이미지의 원본 주소. */
    public String sourceUrl;

    public Instant createdAt = Instant.now();
}
