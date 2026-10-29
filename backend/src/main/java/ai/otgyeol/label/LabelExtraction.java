package ai.otgyeol.label;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

import ai.otgyeol.garment.Domains.GarmentField;

/** 택 판독 1회. 항목별 판독값과 사용자 정정값은 label_extraction_values에 행으로 둔다. */
@Entity
@Table(name = "label_extractions")
public class LabelExtraction {

    public enum Status { PENDING, DONE, FAILED }

    /** 항목 하나의 판독값. readValue가 null이면 '확인 필요'(읽지 못함)다. */
    @Embeddable
    public record FieldValue(
            @Enumerated(EnumType.STRING) @Column(name = "field_code") GarmentField field,
            @Column(name = "read_value") String readValue,
            @Column(name = "corrected_value") String correctedValue) {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long userId;
    public String rawText;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_code")
    public Status status = Status.PENDING;

    /** status가 FAILED일 때만 값이 있다(DB CHECK). */
    public String errorMessage;

    public Instant createdAt = Instant.now();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "label_extraction_images", joinColumns = @JoinColumn(name = "extraction_id"))
    @Column(name = "image_id")
    public Set<Long> imageIds = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "label_extraction_values", joinColumns = @JoinColumn(name = "extraction_id"))
    public Set<FieldValue> values = new LinkedHashSet<>();
}
