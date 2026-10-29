package ai.otgyeol.garment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ai.otgyeol.care.CareEvent;
import ai.otgyeol.care.CareEventRepository;
import ai.otgyeol.common.ApiException;
import ai.otgyeol.garment.Domains.GarmentField;
import ai.otgyeol.garment.Domains.MaterialPart;
import ai.otgyeol.garment.GarmentDtos.CandidateView;
import ai.otgyeol.garment.GarmentDtos.CareView;
import ai.otgyeol.garment.GarmentDtos.SearchView;
import ai.otgyeol.garment.GarmentDtos.ExtractionView;
import ai.otgyeol.garment.GarmentDtos.FieldValueView;
import ai.otgyeol.garment.GarmentDtos.GarmentDetail;
import ai.otgyeol.garment.GarmentDtos.GarmentInput;
import ai.otgyeol.garment.GarmentDtos.GarmentSummary;
import ai.otgyeol.garment.GarmentDtos.ImageView;
import ai.otgyeol.garment.GarmentDtos.MaterialInput;
import ai.otgyeol.garment.GarmentDtos.MaterialView;
import ai.otgyeol.garment.GarmentDtos.MeasurementView;
import ai.otgyeol.garment.GarmentDtos.ProductView;
import ai.otgyeol.image.GarmentCoverImage;
import ai.otgyeol.image.GarmentCoverImageRepository;
import ai.otgyeol.image.GarmentImage;
import ai.otgyeol.image.GarmentImageRepository;
import ai.otgyeol.image.ImageAssetRepository;
import ai.otgyeol.image.ImageController;
import ai.otgyeol.image.ImageKind;
import ai.otgyeol.image.ImageProcessingRepository;
import ai.otgyeol.label.GarmentLabelExtraction;
import ai.otgyeol.label.GarmentLabelExtractionRepository;
import ai.otgyeol.label.GarmentProduct;
import ai.otgyeol.label.GarmentProductRepository;
import ai.otgyeol.label.LabelExtraction;
import ai.otgyeol.label.LabelExtractionRepository;
import ai.otgyeol.label.LabelExtractionSearchRepository;
import ai.otgyeol.label.ProductCandidate;
import ai.otgyeol.label.ProductCandidateRepository;
import ai.otgyeol.label.ProductSearchRepository;
import ai.otgyeol.space.GarmentPlacement;
import ai.otgyeol.space.GarmentPlacementRepository;
import ai.otgyeol.space.StorageSpaceRepository;

/**
 * 의류 등록·수정·상태 변경. 모든 조회는 소유자 ID로 거르고 남의 자료는 404로 처리한다.
 * 같은 주인 규칙은 DB 트리거도 강제하지만, 서버가 먼저 확인해 사용자에게 이유를 보여 준다.
 */
@Service
public class GarmentService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final GarmentRepository garments;
    private final ClosetContext.Loader contextLoader;
    private final ClosetCollectionRepository collections;
    private final ImageAssetRepository images;
    private final GarmentImageRepository garmentImages;
    private final GarmentCoverImageRepository covers;
    private final ImageProcessingRepository processings;
    private final LabelExtractionRepository extractions;
    private final GarmentLabelExtractionRepository garmentExtractions;
    private final LabelExtractionSearchRepository extractionSearches;
    private final ProductSearchRepository searches;
    private final ProductCandidateRepository candidates;
    private final GarmentProductRepository garmentProducts;
    private final CareEventRepository careEvents;
    private final GarmentPlacementRepository placements;
    private final StorageSpaceRepository spaces;

    public GarmentService(GarmentRepository garments, ClosetContext.Loader contextLoader,
            ClosetCollectionRepository collections, ImageAssetRepository images, GarmentImageRepository garmentImages,
            GarmentCoverImageRepository covers, ImageProcessingRepository processings,
            LabelExtractionRepository extractions, GarmentLabelExtractionRepository garmentExtractions,
            LabelExtractionSearchRepository extractionSearches, ProductSearchRepository searches,
            ProductCandidateRepository candidates, GarmentProductRepository garmentProducts,
            CareEventRepository careEvents, GarmentPlacementRepository placements, StorageSpaceRepository spaces) {
        this.garments = garments;
        this.contextLoader = contextLoader;
        this.collections = collections;
        this.images = images;
        this.garmentImages = garmentImages;
        this.covers = covers;
        this.processings = processings;
        this.extractions = extractions;
        this.garmentExtractions = garmentExtractions;
        this.extractionSearches = extractionSearches;
        this.searches = searches;
        this.candidates = candidates;
        this.garmentProducts = garmentProducts;
        this.careEvents = careEvents;
        this.placements = placements;
        this.spaces = spaces;
    }

    public Garment owned(long userId, long garmentId) {
        return garments.findByIdAndUserId(garmentId, userId).orElseThrow(() -> ApiException.notFound("옷"));
    }

    public ClosetContext context(long userId) {
        return contextLoader.load(userId);
    }

    @Transactional(readOnly = true)
    public List<GarmentSummary> list(long userId, String query) {
        ClosetContext ctx = context(userId);
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return garments.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(g -> summary(g, ctx))
                .filter(s -> q.isEmpty() || matches(s, q))
                .toList();
    }

    @Transactional(readOnly = true)
    public GarmentDetail detail(long userId, long garmentId) {
        Garment g = owned(userId, garmentId);
        ClosetContext ctx = context(userId);
        GarmentStatus status = ctx.status(g);
        GarmentPlacement placement = ctx.placements().get(g.id);
        boolean awaitingConfirm = status == GarmentStatus.RETURNED_UNPLACED && placement != null;

        List<Long> imageIds = garmentImages.findByGarmentIdOrderByImageIdAsc(g.id).stream().map(i -> i.imageId).toList();
        Map<Long, ImageKind> kinds = imageKinds(imageIds);
        Map<Long, String> sources = new HashMap<>();
        if (!imageIds.isEmpty()) {
            images.findMeta(imageIds).forEach(m -> sources.put(m.getId(), m.getSourceUrl()));
        }
        List<ImageView> imageViews = imageIds.stream()
                .map(id -> new ImageView(id, kinds.get(id).name(), ImageController.url(id), sources.get(id)))
                .toList();

        LabelExtraction latest = extractions.findLatestForGarment(g.id).orElse(null);
        ExtractionView extraction = latest == null ? null : extractionView(latest);
        Long confirmedCandidate = garmentProducts.findById(g.id).map(gp -> gp.candidateId).orElse(null);
        SearchView search = latest == null ? null : searches.findLatestForExtraction(latest.id).map(s -> new SearchView(s.id,
                s.status.name(), s.searchedAt, candidates.findBySearchIdOrderByIdAsc(s.id).stream()
                        .map(c -> new CandidateView(c.id, c.name, c.brand, c.colorName, c.imageUrl, c.sourceUrl, c.matchReason,
                                c.id.equals(confirmedCandidate)))
                        .toList()))
                .orElse(null);
        ProductView product = garmentProducts.findById(g.id).flatMap(gp -> candidates.findById(gp.candidateId).map(c ->
                new ProductView(c.id, c.name, c.brand, c.colorName, c.imageUrl, c.sourceUrl, c.matchReason,
                        searches.findById(c.searchId).map(s -> s.searchedAt).orElse(null), gp.confirmedAt)))
                .orElse(null);
        List<CareView> care = careEvents.findByGarmentIdOrderByIdDesc(g.id).stream().map(GarmentService::careView).toList();

        return new GarmentDetail(summary(g, ctx), g.productCode, g.sizeLabel, g.origin, g.homeStatus.name(),
                g.usableWhenPending, g.aiFields.stream().map(Enum::name).sorted().toList(),
                placement == null ? null : placement.placedAt,
                g.materials.stream()
                        .sorted(Comparator.comparing((Garment.Material m) -> m.part().ordinal())
                                .thenComparing(m -> m.percent(), Comparator.reverseOrder()))
                        .map(m -> new MaterialView(m.part().name(), m.part().label, m.fiber().name(), m.fiber().label, m.percent()))
                        .toList(),
                g.careLines.stream().sorted(Comparator.comparingInt(Garment.CareLine::lineNo)).map(Garment.CareLine::instruction).toList(),
                g.measurements.stream()
                        .sorted(Comparator.comparing((Garment.Measurement m) -> m.part().ordinal()).thenComparing(m -> m.kind().ordinal()))
                        .map(m -> new MeasurementView(m.part().name(), m.part().label, m.kind().name(), m.kind().label,
                                m.valueCm(), m.source(), m.confirmed()))
                        .toList(),
                imageViews, extraction, search, product, care,
                awaitingConfirm ? placement.spaceId : null,
                awaitingConfirm ? ctx.paths().get(placement.spaceId) : null);
    }

    @Transactional
    public GarmentDetail create(long userId, GarmentInput in) {
        Garment g = new Garment();
        g.userId = userId;
        apply(userId, g, in);
        if (in.aiFields() != null) {
            g.aiFields.addAll(in.aiFields());
        }
        garments.save(g);

        Set<Long> linked = new LinkedHashSet<>();
        if (in.imageIds() != null) {
            for (Long imageId : in.imageIds()) {
                linkImage(userId, g.id, imageId);
                linked.add(imageId);
            }
        }
        if (in.extractionId() != null) {
            LabelExtraction extraction = extractions.findByIdAndUserId(in.extractionId(), userId)
                    .orElseThrow(() -> ApiException.notFound("택 분석 결과"));
            if (garmentExtractions.existsById(extraction.id)) {
                throw ApiException.conflict("이미 다른 옷 등록에 쓴 택 분석이에요.");
            }
            garmentExtractions.save(new GarmentLabelExtraction(extraction.id, g.id));
            for (Long imageId : extraction.imageIds) {
                if (!linked.contains(imageId)) {
                    linkImage(userId, g.id, imageId);
                    linked.add(imageId);
                }
            }
        }
        Long cover = in.coverImageId() != null ? in.coverImageId()
                : in.imageIds() != null && !in.imageIds().isEmpty() ? in.imageIds().get(0) : null;
        if (cover != null) {
            if (!linked.contains(cover)) {
                throw ApiException.badRequest("대표 사진은 이 옷에 올린 사진 중에서 골라 주세요.");
            }
            covers.save(new GarmentCoverImage(g.id, cover));
        }
        if (in.candidateId() != null) {
            ProductCandidate candidate = candidates.findOwned(in.candidateId(), userId)
                    .orElseThrow(() -> ApiException.notFound("제품 후보"));
            if (in.extractionId() != null && extractionSearches.findById(candidate.searchId)
                    .map(s -> !s.extractionId.equals(in.extractionId())).orElse(true)) {
                throw ApiException.badRequest("이 택 분석에서 찾은 후보가 아니에요.");
            }
            garmentProducts.save(new GarmentProduct(g.id, candidate.id));
        }
        return detail(userId, g.id);
    }

    @Transactional
    public GarmentDetail update(long userId, long garmentId, GarmentInput in) {
        Garment g = owned(userId, garmentId);
        Set<GarmentField> changed = changedFields(g, in);
        apply(userId, g, in);
        if (in.coverImageId() != null) {
            GarmentImage image = garmentImages.findById(in.coverImageId())
                    .filter(i -> i.garmentId.equals(g.id))
                    .orElseThrow(() -> ApiException.badRequest("대표 사진은 이 옷에 올린 사진 중에서 골라 주세요."));
            covers.findById(g.id).ifPresentOrElse(c -> c.imageId = image.imageId,
                    () -> covers.save(new GarmentCoverImage(g.id, image.imageId)));
        }
        g.aiFields.removeAll(changed);
        g.updatedAt = Instant.now();
        return detail(userId, g.id);
    }

    /** 사용자가 정하는 집 안 상태만 바꾼다. 세탁 중·수선 중·회수는 관리함 기록에서 계산된다. */
    @Transactional
    public GarmentDetail updateStatus(long userId, long garmentId, GarmentDtos.StatusInput in) {
        Garment g = owned(userId, garmentId);
        if (!in.status().isHomeStatus()) {
            throw ApiException.badRequest(in.status().isAway()
                    ? "세탁 중·수선 중은 '세탁·수선 맡기기'로 기록해 주세요."
                    : "회수 완료는 관리함에서 기록해 주세요.");
        }
        if (careEvents.findFirstByGarmentIdAndCompletedAtIsNull(g.id).isPresent()) {
            throw ApiException.conflict("진행 중인 세탁·수선 기록이 있어요. 관리함에서 회수 완료를 먼저 눌러 주세요.");
        }
        g.homeStatus = in.status();
        if (in.usableWhenPending() != null) {
            g.usableWhenPending = in.usableWhenPending();
        }
        g.updatedAt = Instant.now();
        return detail(userId, g.id);
    }

    /** 실제로 옷을 넣은 뒤 위치를 확정한다('재배치 확인'). 위치 확정 시각이 회수 시각보다 나중이 되어 보관 중으로 계산된다. */
    @Transactional
    public GarmentDetail confirmPlacement(long userId, long garmentId, Long spaceId) {
        Garment g = owned(userId, garmentId);
        if (careEvents.findFirstByGarmentIdAndCompletedAtIsNull(g.id).isPresent()) {
            throw ApiException.conflict("세탁·수선 중인 옷은 회수 완료 후에 위치를 확정할 수 있어요.");
        }
        GarmentPlacement current = placements.findById(g.id).orElse(null);
        Long target = spaceId != null ? spaceId : current == null ? null : current.spaceId;
        if (target == null) {
            throw ApiException.badRequest("넣을 공간을 골라 주세요.");
        }
        spaces.findByIdAndUserId(target, userId).orElseThrow(() -> ApiException.notFound("공간"));
        place(g.id, target);
        g.updatedAt = Instant.now();
        return detail(userId, g.id);
    }

    /** 확정 위치를 쓴다(있으면 바꾸고 없으면 만든다). */
    public void place(long garmentId, long spaceId) {
        GarmentPlacement p = placements.findById(garmentId).orElse(null);
        if (p == null) {
            placements.save(new GarmentPlacement(garmentId, spaceId, Instant.now()));
        } else {
            p.spaceId = spaceId;
            p.placedAt = Instant.now();
        }
    }

    @Transactional
    public void delete(long userId, long garmentId) {
        garments.delete(owned(userId, garmentId));
    }

    public GarmentSummary summary(Garment g, ClosetContext ctx) {
        ClothingTemplate template = g.template();
        GarmentStatus status = ctx.status(g);
        GarmentPlacement placement = ctx.placements().get(g.id);
        return new GarmentSummary(g.id, g.name, g.brand, g.colorName, g.colorHex, g.category().name(), g.category().label,
                g.subType.name(), g.subType.label, template == null ? null : template.name(),
                template == null ? null : template.label,
                g.seasons.stream().sorted().map(Enum::name).toList(),
                g.collectionIds.stream().map(ctx.collectionNames()::get).filter(Objects::nonNull).sorted().toList(),
                status.name(), status.label, ctx.usable(g), g.wearFrequency.name(),
                placement == null ? null : placement.spaceId,
                ctx.locationConfirmed(g) ? ctx.paths().get(placement.spaceId) : null,
                ImageController.url(ctx.covers().get(g.id)), g.totalLengthCm());
    }

    public static ExtractionView extractionView(LabelExtraction e) {
        List<FieldValueView> values = e.values.stream()
                .sorted(Comparator.comparing(v -> v.field().ordinal()))
                .map(v -> new FieldValueView(v.field().name(), v.field().label, v.readValue(), v.correctedValue(),
                        v.readValue() == null))
                .toList();
        return new ExtractionView(e.id, e.rawText, e.status.name(), e.errorMessage, values,
                e.imageIds.stream().sorted().toList());
    }

    public static CareView careView(CareEvent c) {
        return new CareView(c.id, c.careType.name(), c.careType.label, c.place.name(), c.place.label, c.shopName,
                c.description, c.droppedOn, c.dueOn, c.completedAt);
    }

    /** 이미지 종류는 저장하지 않고 계산한다: 택 사진 → 정리본 → 제품 이미지 → 옷 사진. */
    private Map<Long, ImageKind> imageKinds(List<Long> imageIds) {
        Map<Long, ImageKind> kinds = new HashMap<>();
        if (imageIds.isEmpty()) {
            return kinds;
        }
        Set<Long> labels = new HashSet<>(extractions.findLabelImageIds(imageIds));
        Set<Long> processed = new HashSet<>();
        processings.findByResultImageIdIn(imageIds).forEach(p -> processed.add(p.resultImageId));
        Map<Long, String> sources = new HashMap<>();
        images.findMeta(imageIds).forEach(m -> sources.put(m.getId(), m.getSourceUrl()));
        for (Long id : imageIds) {
            kinds.put(id, labels.contains(id) ? ImageKind.LABEL
                    : processed.contains(id) ? ImageKind.PROCESSED
                    : sources.get(id) != null ? ImageKind.PRODUCT_ORIGINAL
                    : ImageKind.GARMENT_ORIGINAL);
        }
        return kinds;
    }

    private void linkImage(long userId, long garmentId, long imageId) {
        images.findByIdAndUserId(imageId, userId).orElseThrow(() -> ApiException.notFound("사진"));
        garmentImages.findById(imageId).ifPresent(existing -> {
            if (!existing.garmentId.equals(garmentId)) {
                throw ApiException.badRequest("이미 다른 옷에 연결된 사진이에요.");
            }
        });
        garmentImages.save(new GarmentImage(imageId, garmentId));
    }

    private void apply(long userId, Garment g, GarmentInput in) {
        g.name = in.name().trim();
        g.brand = blankToNull(in.brand());
        g.productCode = blankToNull(in.productCode());
        g.colorName = blankToNull(in.colorName());
        g.colorHex = blankToNull(in.colorHex());
        g.sizeLabel = blankToNull(in.sizeLabel());
        g.origin = blankToNull(in.origin());
        g.subType = in.subType();
        if (in.wearFrequency() != null) {
            g.wearFrequency = in.wearFrequency();
        }
        if (in.usableWhenPending() != null) {
            g.usableWhenPending = in.usableWhenPending();
        }
        g.seasons.clear();
        if (in.seasons() != null) {
            g.seasons.addAll(in.seasons());
        }
        g.collectionIds.clear();
        if (in.collections() != null) {
            for (String raw : in.collections()) {
                String name = raw == null ? "" : raw.trim();
                if (name.isEmpty()) {
                    continue;
                }
                ClosetCollection c = collections.findByUserIdAndName(userId, name).orElseGet(() -> {
                    ClosetCollection created = new ClosetCollection();
                    created.userId = userId;
                    created.name = name;
                    return collections.save(created);
                });
                g.collectionIds.add(c.id);
            }
        }
        g.materials.clear();
        if (in.materials() != null) {
            validateMaterials(in.materials());
            in.materials().forEach(m -> g.materials.add(new Garment.Material(m.part(), m.fiber(), m.percent())));
        }
        g.careLines.clear();
        if (in.careLines() != null) {
            int line = 1;
            for (String raw : in.careLines()) {
                if (raw != null && !raw.isBlank()) {
                    g.careLines.add(new Garment.CareLine(line++, raw.trim()));
                }
            }
        }
        g.measurements.clear();
        if (in.measurements() != null) {
            Set<String> seen = new HashSet<>();
            for (var m : in.measurements()) {
                if (!seen.add(m.part() + "/" + m.kind())) {
                    throw ApiException.badRequest("같은 부위·종류의 치수가 두 번 들어 있어요.");
                }
                g.measurements.add(new Garment.Measurement(m.part(), m.kind(), m.valueCm(), blankToNull(m.source()), false));
            }
        }
    }

    /** 같은 부위·섬유가 두 번 나오지 않고, 부위별 혼용률 합계가 100%여야 한다. */
    static void validateMaterials(List<MaterialInput> materials) {
        Map<MaterialPart, BigDecimal> sums = new HashMap<>();
        Set<String> seen = new HashSet<>();
        for (MaterialInput m : materials) {
            if (!seen.add(m.part() + "/" + m.fiber())) {
                throw ApiException.badRequest(m.part().label + "에 " + m.fiber().label + "이(가) 두 번 들어 있어요.");
            }
            sums.merge(m.part(), m.percent(), BigDecimal::add);
        }
        for (var e : sums.entrySet()) {
            if (e.getValue().compareTo(HUNDRED) != 0) {
                throw ApiException.badRequest(e.getKey().label + " 혼용률 합계가 " + e.getValue().stripTrailingZeros().toPlainString()
                        + "%예요. 100%가 되게 고쳐 주세요.");
            }
        }
    }

    private static Set<GarmentField> changedFields(Garment g, GarmentInput in) {
        Set<GarmentField> changed = EnumSet.noneOf(GarmentField.class);
        compare(changed, GarmentField.NAME, g.name, in.name() == null ? null : in.name().trim());
        compare(changed, GarmentField.BRAND, g.brand, blankToNull(in.brand()));
        compare(changed, GarmentField.PRODUCT_CODE, g.productCode, blankToNull(in.productCode()));
        compare(changed, GarmentField.COLOR, g.colorName, blankToNull(in.colorName()));
        compare(changed, GarmentField.SIZE_LABEL, g.sizeLabel, blankToNull(in.sizeLabel()));
        compare(changed, GarmentField.ORIGIN, g.origin, blankToNull(in.origin()));
        compare(changed, GarmentField.SUB_TYPE, g.subType, in.subType());
        compare(changed, GarmentField.SEASONS, g.seasons, in.seasons() == null ? Set.of() : Set.copyOf(in.seasons()));
        Set<Garment.Material> newMaterials = in.materials() == null ? Set.of()
                : in.materials().stream().map(m -> new Garment.Material(m.part(), m.fiber(), m.percent())).collect(Collectors.toSet());
        if (!sameMaterials(g.materials, newMaterials)) {
            changed.add(GarmentField.MATERIAL);
        }
        List<String> oldLines = g.careLines.stream().sorted(Comparator.comparingInt(Garment.CareLine::lineNo))
                .map(Garment.CareLine::instruction).toList();
        List<String> newLines = in.careLines() == null ? List.of()
                : in.careLines().stream().filter(l -> l != null && !l.isBlank()).map(String::trim).toList();
        compare(changed, GarmentField.CARE, oldLines, newLines);
        return changed;
    }

    private static boolean sameMaterials(Set<Garment.Material> a, Set<Garment.Material> b) {
        if (a.size() != b.size()) {
            return false;
        }
        return a.stream().allMatch(x -> b.stream().anyMatch(y -> x.part() == y.part() && x.fiber() == y.fiber()
                && x.percent().compareTo(y.percent()) == 0));
    }

    private static void compare(Set<GarmentField> changed, GarmentField field, Object before, Object after) {
        if (!Objects.equals(before, after)) {
            changed.add(field);
        }
    }

    private static boolean matches(GarmentSummary s, String q) {
        return Stream.of(s.name(), s.brand(), s.colorName(), s.categoryLabel(), s.subTypeLabel(), s.locationPath())
                .filter(Objects::nonNull)
                .anyMatch(v -> v.toLowerCase(Locale.ROOT).contains(q));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
