package ai.otgyeol.seed;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import ai.otgyeol.care.CareEvent;
import ai.otgyeol.care.CareEventRepository;
import ai.otgyeol.common.Dates;
import ai.otgyeol.garment.Domains.Fiber;
import ai.otgyeol.garment.Domains.MaterialPart;
import ai.otgyeol.garment.Domains.MeasurementKind;
import ai.otgyeol.garment.Domains.MeasurementPart;
import ai.otgyeol.garment.Garment;
import ai.otgyeol.garment.GarmentRepository;
import ai.otgyeol.garment.Season;
import ai.otgyeol.garment.SubType;
import ai.otgyeol.garment.WearFrequency;
import ai.otgyeol.space.GarmentPlacement;
import ai.otgyeol.space.GarmentPlacementRepository;
import ai.otgyeol.space.SpaceType;
import ai.otgyeol.space.StorageSpace;
import ai.otgyeol.space.StorageSpaceParent;
import ai.otgyeol.space.StorageSpaceParentRepository;
import ai.otgyeol.space.StorageSpaceRepository;
import ai.otgyeol.user.User;
import ai.otgyeol.user.UserRepository;

/**
 * docker 첫 기동 때 시드 계정('사용자' 역할)과 흐름 S2~S8에 필요한 선행 데이터를 만든다(옷 11벌, 공간 8곳, 세탁·수선 2건).
 * SEED_USER_EMAIL이 비어 있으면(배포 환경) 아무것도 만들지 않는다. 이미 계정이 있으면 건너뛴다.
 */
@Component
public class SeedRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

    private record M(MaterialPart part, Fiber fiber, int percent) {
    }

    private final String email;
    private final String password;
    private final UserRepository users;
    private final StorageSpaceRepository spaces;
    private final StorageSpaceParentRepository parents;
    private final GarmentRepository garments;
    private final GarmentPlacementRepository placements;
    private final CareEventRepository careEvents;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;

    public SeedRunner(@Value("${app.seed.email:}") String email, @Value("${app.seed.password:}") String password,
            UserRepository users, StorageSpaceRepository spaces, StorageSpaceParentRepository parents,
            GarmentRepository garments, GarmentPlacementRepository placements, CareEventRepository careEvents,
            PasswordEncoder passwordEncoder, JdbcTemplate jdbc) {
        this.email = email;
        this.password = password;
        this.users = users;
        this.spaces = spaces;
        this.parents = parents;
        this.garments = garments;
        this.placements = placements;
        this.careEvents = careEvents;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.isBlank()) {
            return;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(normalized)) {
            return;
        }
        User user = new User();
        user.email = normalized;
        user.passwordHash = passwordEncoder.encode(password);
        users.save(user);
        populateSeedData(user.id);
        log.info("시드 계정과 예시 옷장을 만들었습니다: {}", normalized);
    }

    /** 시드 계정으로 다시 로그인할 때 이전 흐름에서 바뀐 시드 데이터를 초기 상태로 되돌린다. */
    @Transactional
    public void resetIfSeedUser(User user) {
        if (email.isBlank() || user == null || !user.email.equalsIgnoreCase(email.trim())) {
            return;
        }
        jdbc.update("DELETE FROM move_batches WHERE user_id = ?", user.id);
        jdbc.update("DELETE FROM outfits WHERE user_id = ?", user.id);
        jdbc.update("DELETE FROM product_searches WHERE user_id = ?", user.id);
        jdbc.update("DELETE FROM label_extractions WHERE user_id = ?", user.id);
        jdbc.update("DELETE FROM garments WHERE user_id = ?", user.id);
        jdbc.update("DELETE FROM collections WHERE user_id = ?", user.id);
        jdbc.update("DELETE FROM images WHERE user_id = ?", user.id);
        jdbc.update("DELETE FROM storage_spaces WHERE user_id = ?", user.id);
        jdbc.update("DELETE FROM body_profiles WHERE user_id = ?", user.id);
        populateSeedData(user.id);
    }

    private void populateSeedData(long userId) {
        StorageSpace closet = space(userId, null, "옷장 A", SpaceType.HANG, null);
        StorageSpace leftHanger = space(userId, closet.id, "왼쪽 행거", SpaceType.HANG, 8);
        StorageSpace drawer = space(userId, null, "서랍장", SpaceType.FOLD, null);
        StorageSpace secondDrawer = space(userId, drawer.id, "2단", SpaceType.FOLD, 4);
        StorageSpace underBed = space(userId, null, "침대 아래", SpaceType.LONG_TERM, null);
        space(userId, underBed.id, "겨울 박스", SpaceType.LONG_TERM, 10);
        // 옮기는 단위 묶음 기록(R11)의 목적지: 라벨을 붙인 박스와 집 밖(본가).
        space(userId, null, "여름 박스", SpaceType.BOX, 12);
        space(userId, null, "본가", SpaceType.OFFSITE, null);

        // 위치를 정한 지 일주일 된 옷장. 세탁·수선 중인 옷도 원래 자리는 남아 있어 회수 후 그 자리를 제안한다.
        Instant placedAt = Instant.now().minus(7, ChronoUnit.DAYS);
        Garment shirt = garment(userId, "네이비 옥스퍼드 셔츠", "네이비", "#1f2a44", SubType.SHIRT,
                Set.of(Season.SPRING, Season.AUTUMN), List.of(new M(MaterialPart.SHELL, Fiber.COTTON, 100)), 74,
                WearFrequency.HIGH);
        Garment tee = garment(userId, "화이트 반소매 티셔츠", "화이트", "#f4f4ef", SubType.SHORT_SLEEVE_TEE,
                Set.of(Season.SUMMER), List.of(new M(MaterialPart.SHELL, Fiber.COTTON, 100)), 68, WearFrequency.HIGH);
        Garment jacket = garment(userId, "그레이 울 재킷", "그레이", "#6b6e70", SubType.JACKET,
                Set.of(Season.AUTUMN, Season.WINTER),
                List.of(new M(MaterialPart.SHELL, Fiber.WOOL, 70), new M(MaterialPart.SHELL, Fiber.POLYESTER, 30),
                        new M(MaterialPart.LINING, Fiber.POLYESTER, 100)),
                72, WearFrequency.MEDIUM);
        Garment slacks = garment(userId, "블랙 슬랙스", "블랙", "#1b1b1d", SubType.PANTS,
                Set.of(Season.SPRING, Season.AUTUMN, Season.WINTER),
                List.of(new M(MaterialPart.SHELL, Fiber.POLYESTER, 68), new M(MaterialPart.SHELL, Fiber.RAYON, 28),
                        new M(MaterialPart.SHELL, Fiber.POLYURETHANE, 4)),
                100, WearFrequency.HIGH);
        garment(userId, "연청 데님 팬츠", "연청", "#8fb3d9", SubType.JEANS, Set.of(Season.SPRING, Season.AUTUMN),
                List.of(new M(MaterialPart.SHELL, Fiber.COTTON, 98), new M(MaterialPart.SHELL, Fiber.POLYURETHANE, 2)),
                102, WearFrequency.MEDIUM);
        Garment knit = garment(userId, "베이지 니트", "베이지", "#d9c8a9", SubType.KNIT, Set.of(Season.AUTUMN, Season.WINTER),
                List.of(new M(MaterialPart.SHELL, Fiber.WOOL, 50), new M(MaterialPart.SHELL, Fiber.ACRYLIC, 50)), 66,
                WearFrequency.MEDIUM);
        Garment chino = garment(userId, "카키 치노 팬츠", "카키", "#8a8160", SubType.PANTS, Set.of(Season.SPRING, Season.AUTUMN),
                List.of(new M(MaterialPart.SHELL, Fiber.COTTON, 100)), 101, WearFrequency.LOW);

        place(shirt, leftHanger, placedAt);
        place(jacket, leftHanger, placedAt);
        place(tee, secondDrawer, placedAt);
        place(slacks, secondDrawer, placedAt);
        place(knit, secondDrawer, placedAt);
        place(chino, secondDrawer, placedAt);
        // 연청 데님 팬츠는 미배치로 둔다(S6).

        // 묶음 기록 흐름용: 여름 옷 두 벌은 박스로(S4), 셔츠·후드 두 벌은 세탁소로(S5) 한 번에 옮긴다.
        Garment linen = garment(userId, "린넨 반소매 셔츠", "아이보리", "#efe8d8", SubType.SHIRT, Set.of(Season.SUMMER),
                List.of(new M(MaterialPart.SHELL, Fiber.LINEN, 100)), 70, WearFrequency.LOW);
        Garment shorts = garment(userId, "네이비 반바지", "네이비", "#1f2a44", SubType.SHORTS, Set.of(Season.SUMMER),
                List.of(new M(MaterialPart.SHELL, Fiber.COTTON, 100)), 48, WearFrequency.LOW);
        Garment flannel = garment(userId, "체크 플란넬 셔츠", "레드", "#9e3b37", SubType.SHIRT, Set.of(Season.AUTUMN, Season.WINTER),
                List.of(new M(MaterialPart.SHELL, Fiber.COTTON, 100)), 76, WearFrequency.MEDIUM);
        Garment hoodie = garment(userId, "그레이 후드티", "그레이", "#8e8f93", SubType.LONG_SLEEVE_TEE,
                Set.of(Season.SPRING, Season.AUTUMN), List.of(new M(MaterialPart.SHELL, Fiber.COTTON, 80),
                        new M(MaterialPart.SHELL, Fiber.POLYESTER, 20)), 68, WearFrequency.HIGH);
        // 2단 서랍(수용 4벌)을 채우면 S6의 배치 추천이 달라지므로 여유 있는 왼쪽 행거에 둔다.
        place(linen, leftHanger, placedAt);
        place(shorts, leftHanger, placedAt);
        place(flannel, leftHanger, placedAt);
        place(hoodie, leftHanger, placedAt);

        LocalDate today = Dates.today();
        care(knit.id, CareEvent.CareType.WASH, "한빛 세탁소", "드라이클리닝", today.minusDays(4), today.minusDays(1));
        care(chino.id, CareEvent.CareType.REPAIR, "미싱 수선실", "밑단 3cm 줄임", today.minusDays(2), today);
    }

    private StorageSpace space(long userId, Long parentId, String name, SpaceType type, Integer capacity) {
        StorageSpace s = new StorageSpace();
        s.userId = userId;
        s.name = name;
        s.spaceType = type;
        s.capacity = capacity;
        spaces.save(s);
        if (parentId != null) {
            parents.save(new StorageSpaceParent(s.id, parentId));
        }
        return s;
    }

    private Garment garment(long userId, String name, String color, String hex, SubType subType, Set<Season> seasons,
            List<M> materials, int totalLengthCm, WearFrequency frequency) {
        Garment g = new Garment();
        g.userId = userId;
        g.name = name;
        g.colorName = color;
        g.colorHex = hex;
        g.subType = subType;
        g.seasons.addAll(seasons);
        materials.forEach(m -> g.materials.add(new Garment.Material(m.part(), m.fiber(), BigDecimal.valueOf(m.percent()))));
        g.measurements.add(new Garment.Measurement(MeasurementPart.TOTAL_LENGTH, MeasurementKind.LENGTH,
                BigDecimal.valueOf(totalLengthCm), "직접 측정", true));
        g.wearFrequency = frequency;
        return garments.save(g);
    }

    private void place(Garment g, StorageSpace s, Instant at) {
        placements.save(new GarmentPlacement(g.id, s.id, at));
    }

    private void care(long garmentId, CareEvent.CareType type, String shop, String description, LocalDate dropped,
            LocalDate due) {
        CareEvent c = new CareEvent();
        c.garmentId = garmentId;
        c.careType = type;
        c.place = CareEvent.Place.SHOP;
        c.shopName = shop;
        c.description = description;
        c.droppedOn = dropped;
        c.dueOn = due;
        careEvents.save(c);
    }
}
