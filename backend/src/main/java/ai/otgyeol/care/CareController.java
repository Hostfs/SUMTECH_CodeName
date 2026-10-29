package ai.otgyeol.care;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.common.ApiException;
import ai.otgyeol.common.CurrentUser;
import ai.otgyeol.common.Dates;
import ai.otgyeol.garment.ClosetContext;
import ai.otgyeol.garment.Garment;
import ai.otgyeol.garment.GarmentDtos.CareView;
import ai.otgyeol.garment.GarmentDtos.GarmentSummary;
import ai.otgyeol.garment.GarmentRepository;
import ai.otgyeol.garment.GarmentService;
import ai.otgyeol.garment.GarmentStatus;

/**
 * 세탁·수선·회수 관리. 세탁 중·수선 중·회수 후 위치 미확인은 이 기록에서 계산되므로 옷의 상태를 따로 바꾸지 않는다.
 * '오늘 회수 예정'과 '기한 지남'은 요청할 때마다 오늘 날짜로 다시 계산한다.
 */
@RestController
public class CareController {

    public record CareInput(
            @NotNull(message = "세탁인지 수선인지 골라 주세요.") CareEvent.CareType careType,
            @NotNull(message = "맡긴 곳을 골라 주세요.") CareEvent.Place place,
            @Size(max = 100, message = "업체명은 100자까지 쓸 수 있어요.") String shopName,
            @Size(max = 500, message = "내용은 500자까지 쓸 수 있어요.") String description,
            LocalDate droppedOn,
            LocalDate dueOn) {
    }

    public record CareUpdate(CareEvent.CareType careType, @Size(max = 100) String shopName,
            @Size(max = 500) String description, LocalDate dueOn) {
    }

    public record BoardItem(CareView care, GarmentSummary garment, boolean overdue, boolean dueToday) {
    }

    public record Board(String today, List<BoardItem> dueToday, List<BoardItem> overdue, List<BoardItem> inProgress,
            List<BoardItem> history) {
    }

    private final CareEventRepository careEvents;
    private final GarmentRepository garments;
    private final GarmentService garmentService;

    public CareController(CareEventRepository careEvents, GarmentRepository garments, GarmentService garmentService) {
        this.careEvents = careEvents;
        this.garments = garments;
        this.garmentService = garmentService;
    }

    /** 관리함. 배지 숫자는 dueToday·overdue 길이로 표시한다. */
    @GetMapping("/api/care")
    @Transactional(readOnly = true)
    public Board board() {
        long userId = CurrentUser.id();
        LocalDate today = Dates.today();
        ClosetContext ctx = garmentService.context(userId);
        Map<Long, Garment> byId = new HashMap<>();
        garments.findByUserIdOrderByCreatedAtDesc(userId).forEach(g -> byId.put(g.id, g));
        List<BoardItem> items = careEvents.findByOwner(userId).stream()
                .map(c -> new BoardItem(GarmentService.careView(c), garmentService.summary(byId.get(c.garmentId), ctx),
                        c.isOpen() && c.dueOn != null && c.dueOn.isBefore(today),
                        c.isOpen() && today.equals(c.dueOn)))
                .toList();
        List<BoardItem> open = items.stream().filter(i -> i.care().completedAt() == null).toList();
        List<BoardItem> done = items.stream().filter(i -> i.care().completedAt() != null)
                .sorted((a, b) -> b.care().completedAt().compareTo(a.care().completedAt()))
                .limit(30)
                .toList();
        return new Board(today.toString(), open.stream().filter(BoardItem::dueToday).toList(),
                open.stream().filter(BoardItem::overdue).toList(), open, done);
    }

    /** 세탁·수선 맡기기. 옷은 세탁 중·수선 중으로 계산되어 코디 추천에서 빠진다. */
    @PostMapping("/api/garments/{garmentId}/care")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Board create(@PathVariable long garmentId, @Valid @RequestBody CareInput body) {
        long userId = CurrentUser.id();
        Garment g = garmentService.owned(userId, garmentId);
        if (careEvents.findFirstByGarmentIdAndCompletedAtIsNull(g.id).isPresent()) {
            throw ApiException.conflict("이미 진행 중인 세탁·수선 기록이 있어요. 관리함에서 확인해 주세요.");
        }
        LocalDate dropped = body.droppedOn() != null ? body.droppedOn() : Dates.today();
        if (dropped.isAfter(Dates.today())) {
            throw ApiException.badRequest("맡긴 날짜는 오늘이나 그 이전이어야 해요.");
        }
        validateDue(dropped, body.dueOn());
        if (body.place() == CareEvent.Place.HOME && body.shopName() != null && !body.shopName().isBlank()) {
            throw ApiException.badRequest("자택 세탁에는 업체명을 쓰지 않아요.");
        }
        CareEvent c = new CareEvent();
        c.garmentId = g.id;
        c.careType = body.careType();
        c.place = body.place();
        c.shopName = blankToNull(body.shopName());
        c.description = blankToNull(body.description());
        c.droppedOn = dropped;
        c.dueOn = body.dueOn();
        careEvents.save(c);
        g.updatedAt = Instant.now();
        return board();
    }

    /** 예정일 변경, 세탁 → 수선 전환 등. 옷의 상태는 기록에서 계산되므로 따로 바꾸지 않는다. */
    @PatchMapping("/api/care/{id}")
    @Transactional
    public Board update(@PathVariable long id, @Valid @RequestBody CareUpdate body) {
        long userId = CurrentUser.id();
        CareEvent c = openEvent(userId, id);
        if (body.dueOn() != null) {
            validateDue(c.droppedOn, body.dueOn());
            c.dueOn = body.dueOn();
        }
        if (body.shopName() != null) {
            if (c.place == CareEvent.Place.HOME && !body.shopName().isBlank()) {
                throw ApiException.badRequest("자택 세탁에는 업체명을 쓰지 않아요.");
            }
            c.shopName = blankToNull(body.shopName());
        }
        if (body.description() != null) {
            c.description = blankToNull(body.description());
        }
        if (body.careType() != null) {
            c.careType = body.careType();
        }
        return board();
    }

    /** 회수 완료. 진행 중 목록에서 빠지고, 옷은 기존 위치를 제안받는 '회수 완료·위치 미확인'으로 계산된다. */
    @PostMapping("/api/care/{id}/complete")
    @Transactional
    public Board complete(@PathVariable long id) {
        long userId = CurrentUser.id();
        CareEvent c = openEvent(userId, id);
        c.completedAt = Instant.now();
        Garment g = garmentService.owned(userId, c.garmentId);
        // 세탁 대기였던 옷이 세탁을 마치고 돌아오면 더는 세탁 대기가 아니다.
        if (c.careType == CareEvent.CareType.WASH && g.homeStatus == GarmentStatus.WASH_WAITING) {
            g.homeStatus = GarmentStatus.STORED;
        }
        g.updatedAt = Instant.now();
        return board();
    }

    private CareEvent openEvent(long userId, long id) {
        CareEvent c = careEvents.findOwned(id, userId).orElseThrow(() -> ApiException.notFound("세탁·수선 기록"));
        if (!c.isOpen()) {
            throw ApiException.conflict("이미 회수 완료된 기록이에요.");
        }
        return c;
    }

    private static void validateDue(LocalDate dropped, LocalDate due) {
        if (due != null && due.isBefore(dropped)) {
            throw ApiException.badRequest("회수 예정일은 맡긴 날짜보다 앞설 수 없어요.");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
