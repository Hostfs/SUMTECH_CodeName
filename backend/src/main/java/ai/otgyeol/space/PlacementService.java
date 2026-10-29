package ai.otgyeol.space;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ai.otgyeol.common.ApiException;
import ai.otgyeol.common.Dates;
import ai.otgyeol.garment.Category;
import ai.otgyeol.garment.ClosetContext;
import ai.otgyeol.garment.Garment;
import ai.otgyeol.garment.GarmentDtos.GarmentSummary;
import ai.otgyeol.garment.GarmentRepository;
import ai.otgyeol.garment.GarmentService;
import ai.otgyeol.garment.Season;
import ai.otgyeol.garment.SubType;
import ai.otgyeol.garment.WearFrequency;

/**
 * 규칙 기반 배치 추천. 비시즌 옷은 장기보관, 형태 유지가 필요한 옷은 걸기, 나머지는 접기 공간을 우선하고
 * 같은 유형 안에서는 남은 자리가 많은 공간을 고른다. 추천은 '배치 완료' 전까지 현재 위치를 바꾸지 않는다.
 */
@Service
public class PlacementService {

    public record ProposalView(long id, GarmentSummary garment, long spaceId, String spacePath, String reason,
            Integer capacity, int projectedCount, int overBy) {
    }

    private final PlacementProposalRepository proposals;
    private final StorageSpaceRepository spaces;
    private final GarmentRepository garments;
    private final GarmentService garmentService;
    private final LocationPaths locationPaths;

    public PlacementService(PlacementProposalRepository proposals, StorageSpaceRepository spaces, GarmentRepository garments,
            GarmentService garmentService, LocationPaths locationPaths) {
        this.proposals = proposals;
        this.spaces = spaces;
        this.garments = garments;
        this.garmentService = garmentService;
        this.locationPaths = locationPaths;
    }

    /** garmentIds가 비어 있으면 미배치 옷 전체에 대해 추천한다. 같은 옷의 이전 미확정 추천은 새 추천으로 바꾼다. */
    @Transactional
    public List<ProposalView> recommend(long userId, List<Long> garmentIds) {
        List<StorageSpace> leaves = leafSpaces(userId);
        if (leaves.isEmpty()) {
            throw ApiException.badRequest("먼저 '공간 추가'로 수납 공간을 만들어 주세요.");
        }
        ClosetContext ctx = garmentService.context(userId);
        List<Garment> all = garments.findByUserIdOrderByCreatedAtDesc(userId);
        List<Garment> targets = garmentIds == null || garmentIds.isEmpty()
                ? all.stream().filter(ctx::needsPlacement).toList()
                : garmentIds.stream().map(id -> garmentService.owned(userId, id)).toList();
        if (targets.isEmpty()) {
            throw ApiException.badRequest("배치할 옷이 없어요. 모든 옷의 위치가 정해져 있어요.");
        }
        for (Garment g : targets) {
            if (ctx.status(g).isAway()) {
                throw ApiException.conflict("'" + g.name + "'은(는) 세탁·수선 중이라 지금 배치할 수 없어요.");
            }
        }
        proposals.deleteByGarmentIds(targets.stream().map(g -> g.id).toList());

        Map<Long, Integer> load = confirmedLoad(all, ctx);
        Season season = Dates.currentSeason();
        // 자주 입는 옷부터 자리를 잡게 한다.
        List<Garment> ordered = new ArrayList<>(targets);
        ordered.sort(Comparator.comparing((Garment g) -> g.wearFrequency.ordinal()).thenComparing(g -> g.id));
        for (Garment g : ordered) {
            SpaceType preferred = preferredType(g, season);
            StorageSpace chosen = choose(leaves, preferred, load);
            load.merge(chosen.id, 1, Integer::sum);
            PlacementProposal p = new PlacementProposal();
            p.garmentId = g.id;
            p.spaceId = chosen.id;
            p.reason = reason(g, season, preferred, chosen);
            proposals.save(p);
        }
        return pending(userId);
    }

    @Transactional(readOnly = true)
    public List<ProposalView> pending(long userId) {
        ClosetContext ctx = garmentService.context(userId);
        Map<Long, StorageSpace> byId = new HashMap<>();
        spaces.findByUserIdOrderByIdAsc(userId).forEach(s -> byId.put(s.id, s));
        List<Garment> all = garments.findByUserIdOrderByCreatedAtDesc(userId);
        Map<Long, Garment> garmentById = new HashMap<>();
        all.forEach(g -> garmentById.put(g.id, g));
        Map<Long, Integer> load = confirmedLoad(all, ctx);
        List<PlacementProposal> open = proposals.findByOwner(userId);
        open.forEach(p -> load.merge(p.spaceId, 1, Integer::sum));
        return open.stream()
                .map(p -> {
                    StorageSpace s = byId.get(p.spaceId);
                    int projected = load.getOrDefault(s.id, 0);
                    int overBy = s.capacity == null ? 0 : Math.max(0, projected - s.capacity);
                    return new ProposalView(p.id, garmentService.summary(garmentById.get(p.garmentId), ctx), s.id,
                            ctx.paths().get(s.id), p.reason, s.capacity, projected, overBy);
                })
                .toList();
    }

    /** 사용자가 추천 공간을 바꾼다. 여전히 미확정이다. */
    @Transactional
    public List<ProposalView> change(long userId, long proposalId, long spaceId) {
        PlacementProposal p = owned(userId, proposalId);
        spaces.findByIdAndUserId(spaceId, userId).orElseThrow(() -> ApiException.notFound("공간"));
        p.spaceId = spaceId;
        p.reason = "직접 고른 공간이에요.";
        return pending(userId);
    }

    /** 실제로 옷을 넣은 뒤 '배치 완료'를 누르면 위치를 확정하고 추천을 지운다. */
    @Transactional
    public List<ProposalView> apply(long userId, long proposalId) {
        PlacementProposal p = owned(userId, proposalId);
        Garment g = garmentService.owned(userId, p.garmentId);
        if (garmentService.context(userId).status(g).isAway()) {
            throw ApiException.conflict("세탁·수선 중인 옷은 회수 완료 후에 배치할 수 있어요.");
        }
        garmentService.place(g.id, p.spaceId);
        proposals.delete(p);
        return pending(userId);
    }

    @Transactional
    public List<ProposalView> dismiss(long userId, long proposalId) {
        proposals.delete(owned(userId, proposalId));
        return pending(userId);
    }

    private PlacementProposal owned(long userId, long proposalId) {
        PlacementProposal p = proposals.findById(proposalId).orElseThrow(() -> ApiException.notFound("배치 추천"));
        garmentService.owned(userId, p.garmentId);
        return p;
    }

    /** 옷은 가장 안쪽 공간에 넣는다. '옷장 A'가 아니라 '옷장 A → 왼쪽 행거'를 추천한다. */
    private List<StorageSpace> leafSpaces(long userId) {
        Set<Long> hasChildren = new HashSet<>(locationPaths.parentMap(userId).values());
        return spaces.findByUserIdOrderByIdAsc(userId).stream().filter(s -> !hasChildren.contains(s.id)).toList();
    }

    private static Map<Long, Integer> confirmedLoad(List<Garment> all, ClosetContext ctx) {
        Map<Long, Integer> load = new HashMap<>();
        for (Garment g : all) {
            if (ctx.locationConfirmed(g)) {
                load.merge(ctx.placements().get(g.id).spaceId, 1, Integer::sum);
            }
        }
        return load;
    }

    static SpaceType preferredType(Garment g, Season current) {
        if (!g.seasons.isEmpty() && !g.seasons.contains(current)) {
            return SpaceType.LONG_TERM;
        }
        boolean keepShape = g.category() == Category.OUTER || g.category() == Category.DRESS || g.subType == SubType.SHIRT;
        return keepShape ? SpaceType.HANG : SpaceType.FOLD;
    }

    static StorageSpace choose(List<StorageSpace> leaves, SpaceType preferred, Map<Long, Integer> load) {
        Comparator<StorageSpace> byRoom = Comparator.comparingInt((StorageSpace s) -> remaining(s, load)).reversed()
                .thenComparing(s -> s.id);
        Optional<StorageSpace> sameTypeWithRoom = leaves.stream()
                .filter(s -> s.spaceType == preferred && remaining(s, load) > 0)
                .min(byRoom);
        if (sameTypeWithRoom.isPresent()) {
            return sameTypeWithRoom.get();
        }
        Optional<StorageSpace> anyWithRoom = leaves.stream().filter(s -> remaining(s, load) > 0).min(byRoom);
        if (anyWithRoom.isPresent()) {
            return anyWithRoom.get();
        }
        // 모든 공간이 찼으면 같은 유형 중 가장 덜 넘치는 곳을 고르고, 화면에 초과 수량을 보여 준다.
        return leaves.stream().filter(s -> s.spaceType == preferred).min(byRoom)
                .orElseGet(() -> leaves.stream().min(byRoom).orElseThrow());
    }

    private static int remaining(StorageSpace s, Map<Long, Integer> load) {
        return s.capacity == null ? Integer.MAX_VALUE / 2 : s.capacity - load.getOrDefault(s.id, 0);
    }

    private static String reason(Garment g, Season season, SpaceType preferred, StorageSpace chosen) {
        String why = switch (preferred) {
            case LONG_TERM -> "이번 계절(" + season.label + ") 옷이 아니어서 장기보관 공간을 우선했어요.";
            case HANG -> "형태 유지가 필요한 옷이라 걸기 공간을 우선했어요.";
            case FOLD -> "접어서 보관해도 되는 옷이라 접기 공간을 우선했어요.";
        };
        if (chosen.spaceType != preferred) {
            why += " 해당 유형에 남는 자리가 없어 " + chosen.spaceType.label + " 공간을 골랐어요.";
        }
        if (g.wearFrequency == WearFrequency.HIGH) {
            why += " 자주 입는 옷이에요.";
        }
        return why;
    }
}
