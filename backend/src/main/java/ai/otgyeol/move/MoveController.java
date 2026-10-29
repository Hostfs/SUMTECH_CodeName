package ai.otgyeol.move;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.care.CareEvent;
import ai.otgyeol.care.CareEventRepository;
import ai.otgyeol.common.ApiException;
import ai.otgyeol.common.CurrentUser;
import ai.otgyeol.common.Dates;
import ai.otgyeol.garment.ClosetContext;
import ai.otgyeol.garment.Garment;
import ai.otgyeol.garment.GarmentDtos.GarmentSummary;
import ai.otgyeol.garment.GarmentRepository;
import ai.otgyeol.garment.GarmentService;
import ai.otgyeol.image.ImageAssetRepository;
import ai.otgyeol.image.ImageController;
import ai.otgyeol.space.PlacementProposalRepository;
import ai.otgyeol.space.SpaceType;
import ai.otgyeol.space.StorageSpace;
import ai.otgyeol.space.StorageSpaceRepository;

/**
 * R11 옮기는 단위 묶음 기록. 옷 여러 벌을 한 번에 박스·집 밖 공간으로 옮기거나 세탁소에 맡긴다.
 * 공간으로 옮기면 각 옷의 확정 위치가 바뀌고, 세탁소면 옷마다 세탁 기록(R08)이 생겨 관리함에서 회수를 챙긴다.
 */
@RestController
@RequestMapping("/api/moves")
public class MoveController {

    public enum Destination { SPACE, LAUNDRY }

    public record NewSpace(
            @NotBlank(message = "보낼 곳 이름을 입력해 주세요.") @Size(max = 100, message = "이름은 100자까지 쓸 수 있어요.") String name,
            @NotNull(message = "박스인지 집 밖인지 골라 주세요.") SpaceType spaceType) {
    }

    public record MoveInput(
            @NotNull(message = "보낼 곳을 골라 주세요.") Destination destination,
            Long spaceId,
            @Valid NewSpace newSpace,
            @Size(max = 100, message = "업체명은 100자까지 쓸 수 있어요.") String shopName,
            LocalDate movedOn,
            LocalDate dueOn,
            @NotEmpty(message = "옮길 옷을 골라 주세요.") @Size(max = 200) List<Long> garmentIds,
            @Size(max = 4, message = "사진은 4장까지 남길 수 있어요.") List<Long> imageIds) {
    }

    public record BatchView(long id, Instant createdAt, String destination, Long spaceId, String spacePath,
            String spaceType, String shopName, LocalDate movedOn, LocalDate dueOn, List<GarmentSummary> garments,
            List<String> imageUrls) {
    }

    private final MoveBatchRepository batches;
    private final MoveBatchSpaceRepository batchSpaces;
    private final GarmentService garmentService;
    private final GarmentRepository garments;
    private final CareEventRepository careEvents;
    private final StorageSpaceRepository spaces;
    private final PlacementProposalRepository proposals;
    private final ImageAssetRepository images;

    public MoveController(MoveBatchRepository batches, MoveBatchSpaceRepository batchSpaces, GarmentService garmentService,
            GarmentRepository garments, CareEventRepository careEvents, StorageSpaceRepository spaces,
            PlacementProposalRepository proposals, ImageAssetRepository images) {
        this.batches = batches;
        this.batchSpaces = batchSpaces;
        this.garmentService = garmentService;
        this.garments = garments;
        this.careEvents = careEvents;
        this.spaces = spaces;
        this.proposals = proposals;
        this.images = images;
    }

    /** 최근 묶음(최신순). 화면은 가장 최근 묶음의 보낸 곳·업체를 기본값으로 쓴다. */
    @GetMapping
    @Transactional(readOnly = true)
    public List<BatchView> recent() {
        long userId = CurrentUser.id();
        return views(userId, batches.findTop20ByUserIdOrderByIdDesc(userId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public BatchView move(@Valid @RequestBody MoveInput in) {
        long userId = CurrentUser.id();
        List<Long> garmentIds = List.copyOf(new LinkedHashSet<>(in.garmentIds()));
        List<Garment> moving = garmentIds.stream().map(id -> garmentService.owned(userId, id)).toList();
        LocalDate movedOn = in.movedOn() != null ? in.movedOn() : Dates.today();
        if (movedOn.isAfter(Dates.today())) {
            throw ApiException.badRequest("옮긴 날짜는 오늘이나 그 이전이어야 해요.");
        }

        MoveBatch batch = new MoveBatch();
        batch.userId = userId;
        if (in.imageIds() != null) {
            for (Long imageId : in.imageIds()) {
                images.findByIdAndUserId(imageId, userId).orElseThrow(() -> ApiException.notFound("사진"));
                batch.imageIds.add(imageId);
            }
        }

        if (in.destination() == Destination.SPACE) {
            StorageSpace target = targetSpace(userId, in);
            // 가장 안쪽 공간인지, 세탁·수선 중인 옷이 없는지는 직접 넣기와 같은 규칙으로 확인한다.
            garmentService.placeDirectly(userId, target.id, garmentIds);
            proposals.deleteByGarmentIds(garmentIds);
            batches.save(batch);
            MoveBatchSpace dest = new MoveBatchSpace();
            dest.batchId = batch.id;
            dest.spaceId = target.id;
            dest.movedOn = movedOn;
            dest.garmentIds.addAll(garmentIds);
            batchSpaces.save(dest);
        } else {
            if (in.dueOn() != null && in.dueOn().isBefore(movedOn)) {
                throw ApiException.badRequest("회수 예정일은 맡긴 날짜보다 앞설 수 없어요.");
            }
            String shop = in.shopName() == null || in.shopName().isBlank() ? null : in.shopName().trim();
            for (Garment g : moving) {
                if (careEvents.findFirstByGarmentIdAndCompletedAtIsNull(g.id).isPresent()) {
                    throw ApiException.conflict("'" + g.name + "'은(는) 이미 세탁·수선 중이에요. 관리함에서 확인해 주세요.");
                }
                CareEvent c = new CareEvent();
                c.garmentId = g.id;
                c.careType = CareEvent.CareType.WASH;
                c.place = CareEvent.Place.SHOP;
                c.shopName = shop;
                c.droppedOn = movedOn;
                c.dueOn = in.dueOn();
                careEvents.save(c);
                batch.careEventIds.add(c.id);
                g.updatedAt = Instant.now();
            }
            batches.save(batch);
        }
        return views(userId, List.of(batch)).get(0);
    }

    private StorageSpace targetSpace(long userId, MoveInput in) {
        if (in.spaceId() != null) {
            return spaces.findByIdAndUserId(in.spaceId(), userId).orElseThrow(() -> ApiException.notFound("공간"));
        }
        if (in.newSpace() == null) {
            throw ApiException.badRequest("보낼 박스나 장소를 골라 주세요.");
        }
        if (in.newSpace().spaceType() != SpaceType.BOX && in.newSpace().spaceType() != SpaceType.OFFSITE) {
            throw ApiException.badRequest("새로 만드는 곳은 박스나 집 밖만 고를 수 있어요.");
        }
        StorageSpace s = new StorageSpace();
        s.userId = userId;
        s.name = in.newSpace().name().trim();
        s.spaceType = in.newSpace().spaceType();
        return spaces.save(s);
    }

    private List<BatchView> views(long userId, List<MoveBatch> list) {
        ClosetContext ctx = garmentService.context(userId);
        Map<Long, Garment> byId = new HashMap<>();
        garments.findByUserIdOrderByCreatedAtDesc(userId).forEach(g -> byId.put(g.id, g));
        Map<Long, StorageSpace> spaceById = new HashMap<>();
        spaces.findByUserIdOrderByIdAsc(userId).forEach(s -> spaceById.put(s.id, s));
        List<BatchView> out = new ArrayList<>();
        for (MoveBatch b : list) {
            List<String> urls = b.imageIds.stream().sorted().map(ImageController::url).toList();
            MoveBatchSpace dest = batchSpaces.findById(b.id).orElse(null);
            if (dest != null) {
                StorageSpace s = spaceById.get(dest.spaceId);
                out.add(new BatchView(b.id, b.createdAt, Destination.SPACE.name(), dest.spaceId, ctx.paths().get(dest.spaceId),
                        s == null ? null : s.spaceType.name(), null, dest.movedOn, null,
                        summaries(dest.garmentIds, byId, ctx), urls));
            } else {
                List<CareEvent> cares = careEvents.findAllById(b.careEventIds);
                CareEvent first = cares.isEmpty() ? null : cares.get(0);
                Set<Long> ids = new LinkedHashSet<>();
                cares.forEach(c -> ids.add(c.garmentId));
                out.add(new BatchView(b.id, b.createdAt, Destination.LAUNDRY.name(), null, null, null,
                        first == null ? null : first.shopName, first == null ? null : first.droppedOn,
                        first == null ? null : first.dueOn, summaries(ids, byId, ctx), urls));
            }
        }
        return out;
    }

    private List<GarmentSummary> summaries(Set<Long> ids, Map<Long, Garment> byId, ClosetContext ctx) {
        return ids.stream().map(byId::get).filter(Objects::nonNull).map(g -> garmentService.summary(g, ctx)).toList();
    }
}
