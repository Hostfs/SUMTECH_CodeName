package ai.otgyeol.garment;

import java.math.BigDecimal;
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

import ai.otgyeol.garment.Domains.Fiber;
import ai.otgyeol.garment.Domains.GarmentField;
import ai.otgyeol.garment.Domains.MaterialPart;
import ai.otgyeol.garment.Domains.MeasurementKind;
import ai.otgyeol.garment.Domains.MeasurementPart;

/**
 * 사용자 소유의 실물 한 벌(garments). 종류는 세부 종류에서 계산하고, 위치·대표 이미지·확정 제품·현재 상태처럼
 * 다른 개체에서 정해지는 값은 저장하지 않는다(docs/db/ERD.md 5절).
 */
@Entity
@Table(name = "garments")
public class Garment {

    @Embeddable
    public record Material(
            @Enumerated(EnumType.STRING) @Column(name = "part_code") MaterialPart part,
            @Enumerated(EnumType.STRING) @Column(name = "fiber_code") Fiber fiber,
            @Column(name = "percent") BigDecimal percent) {
    }

    @Embeddable
    public record CareLine(@Column(name = "line_no") int lineNo, @Column(name = "instruction") String instruction) {
    }

    @Embeddable
    public record Measurement(
            @Enumerated(EnumType.STRING) @Column(name = "part_code") MeasurementPart part,
            @Enumerated(EnumType.STRING) @Column(name = "kind_code") MeasurementKind kind,
            @Column(name = "value_cm") BigDecimal valueCm,
            @Column(name = "source") String source,
            @Column(name = "confirmed") boolean confirmed) {
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long userId;
    public String name;
    public String brand;
    public String productCode;
    public String colorName;
    public String colorHex;
    public String sizeLabel;
    public String origin;
    public String memo;

    @Enumerated(EnumType.STRING)
    @Column(name = "sub_type_code")
    public SubType subType;

    @Enumerated(EnumType.STRING)
    @Column(name = "wear_frequency_code")
    public WearFrequency wearFrequency = WearFrequency.MEDIUM;

    /** 사용자가 정하는 집 안 상태만(보관 중·착용·보관 전·세탁 대기). */
    @Enumerated(EnumType.STRING)
    @Column(name = "status_code")
    public GarmentStatus homeStatus = GarmentStatus.STORED;

    public boolean usableWhenPending;
    public Instant createdAt = Instant.now();
    public Instant updatedAt = Instant.now();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "garment_seasons", joinColumns = @JoinColumn(name = "garment_id"))
    @Column(name = "season_code")
    @Enumerated(EnumType.STRING)
    public Set<Season> seasons = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "garment_collections", joinColumns = @JoinColumn(name = "garment_id"))
    @Column(name = "collection_id")
    public Set<Long> collectionIds = new LinkedHashSet<>();

    /** AI가 채웠고 사용자가 아직 고치지 않은 항목. 사용자가 고친 값은 AI 재분석으로 덮어쓰지 않는다. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "garment_ai_fields", joinColumns = @JoinColumn(name = "garment_id"))
    @Column(name = "field_code")
    @Enumerated(EnumType.STRING)
    public Set<GarmentField> aiFields = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "garment_materials", joinColumns = @JoinColumn(name = "garment_id"))
    public Set<Material> materials = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "garment_care_instructions", joinColumns = @JoinColumn(name = "garment_id"))
    public Set<CareLine> careLines = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "garment_measurements", joinColumns = @JoinColumn(name = "garment_id"))
    public Set<Measurement> measurements = new LinkedHashSet<>();

    public Category category() {
        return subType.category;
    }

    public ClothingTemplate template() {
        return subType.template;
    }

    /** 3D 코디에 쓰는 총장(cm). 치수 테이블의 (총장, 길이) 행. */
    public BigDecimal totalLengthCm() {
        return measurements.stream()
                .filter(m -> m.part() == MeasurementPart.TOTAL_LENGTH && m.kind() == MeasurementKind.LENGTH)
                .map(Measurement::valueCm)
                .findFirst()
                .orElse(null);
    }
}
