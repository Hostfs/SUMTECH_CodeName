package ai.otgyeol.space;

import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.common.ApiException;
import ai.otgyeol.common.CurrentUser;
import ai.otgyeol.garment.ClosetContext;
import ai.otgyeol.garment.Garment;
import ai.otgyeol.garment.GarmentDtos.GarmentSummary;
import ai.otgyeol.garment.GarmentRepository;
import ai.otgyeol.garment.GarmentService;

/** 옷장 지도: 수납 공간과 공간별 옷, 미배치 목록. */
@RestController
@RequestMapping("/api/spaces")
public class SpaceController {

    public record SpaceInput(
            @NotBlank(message = "공간 이름을 입력해 주세요.") @Size(max = 100, message = "공간 이름은 100자까지 쓸 수 있어요.") String name,
            Long parentId,
            @NotNull(message = "공간 유형을 골라 주세요.") SpaceType spaceType,
            @Min(value = 1, message = "수용 개수는 1 이상이어야 해요.") @Max(value = 500, message = "수용 개수는 500 이하여야 해요.") Integer capacity) {
    }

    public record SpaceView(long id, Long parentId, String name, String path, String spaceType, String spaceTypeLabel,
            Integer capacity, int count, int overBy, List<GarmentSummary> garments) {
    }

    public record MapView(List<SpaceView> spaces, List<GarmentSummary> unplaced) {
    }

    public record PutGarmentsInput(@NotEmpty(message = "넣을 옷을 골라 주세요.") @Size(max = 200) List<Long> garmentIds) {
    }

    private final StorageSpaceRepository spaces;
    private final PlacementProposalRepository proposals;
    private final StorageSpaceParentRepository parents;
    private final GarmentPlacementRepository placements;
    private final GarmentRepository garments;
    private final GarmentService garmentService;
    private final LocationPaths locationPaths;

    public SpaceController(StorageSpaceRepository spaces, StorageSpaceParentRepository parents,
            GarmentPlacementRepository placements, GarmentRepository garments, GarmentService garmentService,
            LocationPaths locationPaths, PlacementProposalRepository proposals) {
        this.spaces = spaces;
        this.proposals = proposals;
        this.parents = parents;
        this.placements = placements;
        this.garments = garments;
        this.garmentService = garmentService;
        this.locationPaths = locationPaths;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public MapView map() {
        long userId = CurrentUser.id();
        ClosetContext ctx = garmentService.context(userId);
        Map<Long, Long> parentOf = locationPaths.parentMap(userId);
        List<Garment> all = garments.findByUserIdOrderByCreatedAtDesc(userId);
        List<SpaceView> views = spaces.findByUserIdOrderByIdAsc(userId).stream().map(s -> {
            // 공간에 실제로 들어 있는 옷: 위치가 확정되었고 집에 있으며 회수 후 미확인이 아닌 옷
            List<GarmentSummary> inSpace = all.stream()
                    .filter(g -> ctx.locationConfirmed(g) && s.id.equals(ctx.placements().get(g.id).spaceId))
                    .map(g -> garmentService.summary(g, ctx))
                    .toList();
            int overBy = s.capacity == null ? 0 : Math.max(0, inSpace.size() - s.capacity);
            return new SpaceView(s.id, parentOf.get(s.id), s.name, ctx.paths().get(s.id), s.spaceType.name(),
                    s.spaceType.label, s.capacity, inSpace.size(), overBy, inSpace);
        }).toList();
        List<GarmentSummary> unplaced = all.stream()
                .filter(ctx::needsPlacement)
                .map(g -> garmentService.summary(g, ctx))
                .toList();
        return new MapView(views, unplaced);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public MapView create(@Valid @RequestBody SpaceInput body) {
        long userId = CurrentUser.id();
        StorageSpace space = new StorageSpace();
        space.userId = userId;
        apply(space, body);
        spaces.save(space);
        setParent(userId, space.id, body.parentId());
        return map();
    }

    @PutMapping("/{id}")
    @Transactional
    public MapView update(@PathVariable long id, @Valid @RequestBody SpaceInput body) {
        long userId = CurrentUser.id();
        StorageSpace space = spaces.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("공간"));
        apply(space, body);
        setParent(userId, space.id, body.parentId());
        return map();
    }

    /** 고른 옷을 이 공간에 바로 넣는다(위치 확정). 그 옷들의 미확정 배치 추천은 지운다. */
    @PostMapping("/{id}/garments")
    @Transactional
    public MapView putGarments(@PathVariable long id, @Valid @RequestBody PutGarmentsInput body) {
        long userId = CurrentUser.id();
        garmentService.placeDirectly(userId, id, body.garmentIds());
        proposals.deleteByGarmentIds(body.garmentIds());
        return map();
    }

    @DeleteMapping("/{id}")
    @Transactional
    public MapView delete(@PathVariable long id) {
        long userId = CurrentUser.id();
        StorageSpace space = spaces.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("공간"));
        if (placements.countBySpaceId(id) > 0) {
            throw ApiException.conflict("이 공간에 옷이 있어요. 옷을 다른 곳으로 옮긴 뒤 삭제해 주세요.");
        }
        // 바깥 공간을 지우면 안쪽 공간이 조용히 최상위가 되므로 막는다.
        if (parents.existsByParentSpaceId(id)) {
            throw ApiException.conflict("이 공간 안에 다른 공간이 있어요. 안쪽 공간부터 삭제해 주세요.");
        }
        spaces.delete(space);
        return map();
    }

    private static void apply(StorageSpace space, SpaceInput body) {
        space.name = body.name().trim();
        space.spaceType = body.spaceType();
        space.capacity = body.capacity();
    }

    /** 상위 공간을 정한다. 내 공간만, 순환 없이. */
    private void setParent(long userId, long spaceId, Long parentId) {
        if (parentId == null) {
            parents.findById(spaceId).ifPresent(parents::delete);
            return;
        }
        spaces.findByIdAndUserId(parentId, userId).orElseThrow(() -> ApiException.notFound("상위 공간"));
        if (placements.countBySpaceId(parentId) > 0) {
            throw ApiException.badRequest("옷이 들어 있는 공간 안에는 다른 공간을 만들 수 없어요. 옷을 먼저 옮겨 주세요.");
        }
        Map<Long, Long> parentOf = locationPaths.parentMap(userId);
        for (Long cur = parentId; cur != null; cur = parentOf.get(cur)) {
            if (cur == spaceId) {
                throw ApiException.badRequest("공간을 자기 자신이나 자기 안쪽 공간 안에 넣을 수 없어요.");
            }
        }
        parents.findById(spaceId).ifPresentOrElse(p -> p.parentSpaceId = parentId,
                () -> parents.save(new StorageSpaceParent(spaceId, parentId)));
    }
}
