package ai.otgyeol.garment;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import ai.otgyeol.garment.Domains.Fiber;
import ai.otgyeol.garment.Domains.GarmentField;
import ai.otgyeol.garment.Domains.MaterialPart;
import ai.otgyeol.garment.Domains.MeasurementKind;
import ai.otgyeol.garment.Domains.MeasurementPart;

/** 의류 API의 요청·응답 형태. */
public final class GarmentDtos {

    private GarmentDtos() {
    }

    public record MaterialInput(
            @NotNull(message = "소재 부위를 골라 주세요.") MaterialPart part,
            @NotNull(message = "섬유를 골라 주세요.") Fiber fiber,
            @NotNull(message = "혼용률을 입력해 주세요.") @DecimalMin(value = "0.1", message = "혼용률은 0보다 커야 해요.") @DecimalMax(value = "100", message = "혼용률은 100% 이하여야 해요.") BigDecimal percent) {
    }

    public record MeasurementInput(
            @NotNull(message = "치수 부위를 골라 주세요.") MeasurementPart part,
            @NotNull(message = "치수 종류를 골라 주세요.") MeasurementKind kind,
            @NotNull(message = "치수를 입력해 주세요.") @DecimalMin(value = "0.1", message = "치수는 0보다 커야 해요.") @DecimalMax(value = "999", message = "치수가 너무 커요.") BigDecimal valueCm,
            @Size(max = 300) String source) {
    }

    /** 등록과 수정에 같이 쓰는 입력. 등록 때만 imageIds·coverImageId·extractionId·candidateId·aiFields를 읽는다. */
    public record GarmentInput(
            @NotBlank(message = "옷 이름을 입력해 주세요.") @Size(max = 100, message = "옷 이름은 100자까지 쓸 수 있어요.") String name,
            @Size(max = 100) String brand,
            @Size(max = 100) String productCode,
            @Size(max = 50) String colorName,
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "색상 코드는 #RRGGBB 형식이어야 해요.") String colorHex,
            @Size(max = 50) String sizeLabel,
            @Size(max = 100) String origin,
            @NotNull(message = "옷 종류를 골라 주세요.") SubType subType,
            WearFrequency wearFrequency,
            Set<Season> seasons,
            Set<@Size(max = 50, message = "컬렉션 이름은 50자까지 쓸 수 있어요.") String> collections,
            List<@Valid MaterialInput> materials,
            List<@Size(max = 200, message = "세탁·관리 지시는 한 줄에 200자까지 쓸 수 있어요.") String> careLines,
            List<@Valid MeasurementInput> measurements,
            Boolean usableWhenPending,
            List<Long> imageIds,
            Long coverImageId,
            Long extractionId,
            Long candidateId,
            Set<GarmentField> aiFields) {
    }

    public record StatusInput(@NotNull(message = "상태를 골라 주세요.") GarmentStatus status, Boolean usableWhenPending) {
    }

    public record ConfirmPlacementInput(Long spaceId) {
    }

    public record MaterialView(String part, String partLabel, String fiber, String fiberLabel, BigDecimal percent) {
    }

    public record MeasurementView(String part, String partLabel, String kind, String kindLabel, BigDecimal valueCm,
            String source, boolean confirmed) {
    }

    public record ImageView(long id, String kind, String url, String sourceUrl) {
    }

    public record FieldValueView(String field, String fieldLabel, String readValue, String correctedValue, boolean unread) {
    }

    public record ExtractionView(long id, String rawText, String status, String errorMessage, List<FieldValueView> values,
            List<Long> imageIds) {
    }

    public record CandidateView(long id, String name, String brand, String colorName, String imageUrl, String sourceUrl,
            String matchReason, boolean confirmed) {
    }

    /** 이 옷의 택 판독으로 한 마지막 제품 검색. 후보가 0개면 '검색 결과 없음'. */
    public record SearchView(long id, String status, Instant searchedAt, List<CandidateView> candidates) {
    }

    public record ProductView(long candidateId, String name, String brand, String colorName, String imageUrl,
            String sourceUrl, String matchReason, Instant searchedAt, Instant confirmedAt) {
    }

    public record CareView(long id, String careType, String careTypeLabel, String place, String placeLabel, String shopName,
            String description, LocalDate droppedOn, LocalDate dueOn, Instant completedAt) {
    }

    public record GarmentSummary(long id, String name, String brand, String colorName, String colorHex, String category,
            String categoryLabel, String subType, String subTypeLabel, String template, String templateLabel,
            List<String> seasons, List<String> collections, String status, String statusLabel, boolean usable,
            String wearFrequency, Long spaceId, String locationPath, String imageUrl, BigDecimal totalLengthCm) {
    }

    public record GarmentDetail(GarmentSummary summary, String productCode, String sizeLabel, String origin,
            String homeStatus, boolean usableWhenPending, List<String> aiFields, Instant placedAt,
            List<MaterialView> materials, List<String> careLines, List<MeasurementView> measurements,
            List<ImageView> images, ExtractionView extraction, SearchView search, ProductView product, List<CareView> careHistory,
            Long suggestedSpaceId, String suggestedLocationPath) {
    }
}
