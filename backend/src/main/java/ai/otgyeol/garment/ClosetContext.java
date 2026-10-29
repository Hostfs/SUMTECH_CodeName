package ai.otgyeol.garment;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import ai.otgyeol.care.CareEvent;
import ai.otgyeol.care.CareEventRepository;
import ai.otgyeol.image.GarmentCoverImageRepository;
import ai.otgyeol.space.GarmentPlacement;
import ai.otgyeol.space.GarmentPlacementRepository;
import ai.otgyeol.space.LocationPaths;
import ai.otgyeol.space.SpaceType;
import ai.otgyeol.space.StorageSpaceRepository;

/**
 * 한 사용자의 옷장을 보여 줄 때 필요한 연결 정보를 한 번에 읽은 것.
 * 저장하지 않는 값(현재 상태, 위치 경로, 사용 가능 여부)은 여기서 계산한다(docs/db/ERD.md 5절).
 */
public record ClosetContext(
        Map<Long, String> paths,
        Map<Long, SpaceType> spaceTypes,
        Map<Long, GarmentPlacement> placements,
        Map<Long, CareEvent> openCare,
        Map<Long, Instant> lastReturned,
        Map<Long, Long> covers,
        Map<Long, String> collectionNames) {

    /** ① 진행 중 세탁·수선 ② 회수 후 위치 확정 전 ③ 사용자가 정한 집 안 상태 */
    public GarmentStatus status(Garment g) {
        CareEvent open = openCare.get(g.id);
        if (open != null) {
            return open.careType.garmentStatus;
        }
        Instant returned = lastReturned.get(g.id);
        GarmentPlacement placement = placements.get(g.id);
        if (returned != null && (placement == null || returned.isAfter(placement.placedAt))) {
            return GarmentStatus.RETURNED_UNPLACED;
        }
        return g.homeStatus;
    }

    /** 그 위치에 실제로 있다고 말할 수 있는지. 집에 없거나 회수 후 확인 전이면 아니다. */
    public boolean locationConfirmed(Garment g) {
        GarmentStatus s = status(g);
        return placements.containsKey(g.id) && !s.isAway() && s != GarmentStatus.RETURNED_UNPLACED;
    }

    /** 기본 코디 추천 후보가 될 수 있는지. 세탁 대기·세탁 중·수선 중은 제외한다. */
    public boolean usable(Garment g) {
        return switch (status(g)) {
            case STORED, RETURNED_UNPLACED -> true;
            case PENDING -> g.usableWhenPending;
            case WASH_WAITING, WASHING, REPAIRING -> false;
        };
    }

    /** 집 안·박스 속·집 밖·세탁소·미배치 중 어디인지. */
    public LocationKind locationKind(Garment g) {
        if (status(g).isAway()) {
            return LocationKind.CARE;
        }
        if (!locationConfirmed(g)) {
            return LocationKind.UNPLACED;
        }
        return switch (spaceTypes.get(placements.get(g.id).spaceId)) {
            case BOX -> LocationKind.BOX;
            case OFFSITE -> LocationKind.OFFSITE;
            case HANG, FOLD, LONG_TERM -> LocationKind.HOME;
        };
    }

    /** 위치가 정해지지 않았고 집에 있는 옷. */
    public boolean needsPlacement(Garment g) {
        return !placements.containsKey(g.id) && !status(g).isAway();
    }

    @Component
    public static class Loader {

        private final LocationPaths locationPaths;
        private final GarmentPlacementRepository placements;
        private final CareEventRepository careEvents;
        private final GarmentCoverImageRepository covers;
        private final ClosetCollectionRepository collections;
        private final StorageSpaceRepository spaces;

        public Loader(LocationPaths locationPaths, GarmentPlacementRepository placements, CareEventRepository careEvents,
                GarmentCoverImageRepository covers, ClosetCollectionRepository collections, StorageSpaceRepository spaces) {
            this.spaces = spaces;
            this.locationPaths = locationPaths;
            this.placements = placements;
            this.careEvents = careEvents;
            this.covers = covers;
            this.collections = collections;
        }

        public ClosetContext load(long userId) {
            Map<Long, GarmentPlacement> placementMap = new HashMap<>();
            placements.findByOwner(userId).forEach(p -> placementMap.put(p.garmentId, p));
            Map<Long, CareEvent> open = new HashMap<>();
            Map<Long, Instant> returned = new HashMap<>();
            for (CareEvent c : careEvents.findByOwner(userId)) {
                if (c.isOpen()) {
                    open.put(c.garmentId, c);
                } else {
                    returned.merge(c.garmentId, c.completedAt, (a, b) -> a.isAfter(b) ? a : b);
                }
            }
            Map<Long, Long> coverMap = new HashMap<>();
            covers.findByOwner(userId).forEach(c -> coverMap.put(c.garmentId, c.imageId));
            Map<Long, String> names = new HashMap<>();
            collections.findByUserIdOrderByNameAsc(userId).forEach(c -> names.put(c.id, c.name));
            Map<Long, SpaceType> types = new HashMap<>();
            spaces.findByUserIdOrderByIdAsc(userId).forEach(s -> types.put(s.id, s.spaceType));
            return new ClosetContext(locationPaths.forUser(userId), types, placementMap, open, returned, coverMap, names);
        }
    }
}
