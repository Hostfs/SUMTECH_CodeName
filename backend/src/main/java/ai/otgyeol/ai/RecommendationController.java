package ai.otgyeol.ai;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import jakarta.validation.constraints.Size;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.common.ApiException;
import ai.otgyeol.common.CurrentUser;
import ai.otgyeol.garment.Category;
import ai.otgyeol.garment.ClosetContext;
import ai.otgyeol.garment.Garment;
import ai.otgyeol.garment.GarmentDtos.GarmentSummary;
import ai.otgyeol.garment.GarmentRepository;
import ai.otgyeol.garment.GarmentService;
import ai.otgyeol.garment.Season;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * R06 보유 의류 기반 코디 추천. 지금 입을 수 있는 옷(세탁 대기·세탁 중·수선 중 제외)만 모델에 보내고,
 * 모델 응답에서 보낸 목록에 없는 ID나 상의·하의 역할이 맞지 않는 조합은 버린다.
 */
@RestController
public class RecommendationController {

    public record RecommendInput(Season season, @Size(max = 20) String occasion, Long fixedGarmentId) {
    }

    public record Item(GarmentSummary top, GarmentSummary bottom, String reason) {
    }

    public record Result(List<Item> items) {
    }

    private final AiGateway ai;
    private final GarmentRepository garments;
    private final GarmentService garmentService;

    public RecommendationController(AiGateway ai, GarmentRepository garments, GarmentService garmentService) {
        this.ai = ai;
        this.garments = garments;
        this.garmentService = garmentService;
    }

    @PostMapping("/api/recommendations")
    @Transactional(readOnly = true)
    public Result recommend(@RequestBody RecommendInput in) {
        long userId = CurrentUser.id();
        ClosetContext ctx = garmentService.context(userId);
        List<Garment> usable = garments.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(ctx::usable)
                .filter(g -> in.season() == null || g.seasons.isEmpty() || g.seasons.contains(in.season()))
                .toList();
        List<Garment> tops = usable.stream().filter(RecommendationController::isTop).toList();
        List<Garment> bottoms = usable.stream().filter(g -> g.category() == Category.BOTTOM).toList();

        Garment fixed = null;
        if (in.fixedGarmentId() != null) {
            fixed = garmentService.owned(userId, in.fixedGarmentId());
            if (!ctx.usable(fixed)) {
                throw ApiException.badRequest("'" + fixed.name + "'은(는) 지금 " + ctx.status(fixed).label + "이라 추천에 쓸 수 없어요.");
            }
            if (!isTop(fixed) && fixed.category() != Category.BOTTOM) {
                throw ApiException.badRequest("꼭 입을 옷은 상의나 하의로 골라 주세요.");
            }
            final Garment f = fixed;
            if (isTop(f)) {
                tops = List.of(f);
            } else {
                bottoms = List.of(f);
            }
        }
        if (tops.isEmpty() || bottoms.isEmpty()) {
            return new Result(List.of());
        }

        Map<Long, Garment> topById = tops.stream().collect(Collectors.toMap(g -> g.id, Function.identity()));
        Map<Long, Garment> bottomById = bottoms.stream().collect(Collectors.toMap(g -> g.id, Function.identity()));
        JsonNode answer = AiGateway.parseObject(ai.complete(request(in, tops, bottoms), Duration.ofSeconds(40)));

        List<Item> items = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonNode n : answer.path("items")) {
            Garment top = topById.get(n.path("topId").asLong(-1));
            Garment bottom = bottomById.get(n.path("bottomId").asLong(-1));
            String reason = AiGateway.text(n, "reason", 300);
            if (top == null || bottom == null || reason == null || !seen.add(top.id + "-" + bottom.id)) {
                continue;
            }
            items.add(new Item(garmentService.summary(top, ctx), garmentService.summary(bottom, ctx), reason));
            if (items.size() == 3) {
                break;
            }
        }
        return new Result(items);
    }

    private ObjectNode request(RecommendInput in, List<Garment> tops, List<Garment> bottoms) {
        ObjectNode req = ai.newRequest(800);
        ArrayNode messages = (ArrayNode) req.get("messages");
        AiGateway.message(messages, "system").put("content", """
                너는 사용자가 가진 옷으로만 상하의 조합을 고르는 코디 도우미다. 아래 목록에 있는 id만 쓴다. 목록에 없는 옷을 지어내지 않는다.
                색 조화, 계절, 상황에 맞는지를 보고 최대 3개 조합을 고른다. 이유는 한국어 한두 문장으로, 실제 옷 이름과 색을 들어 설명한다.
                반드시 {"items": [{"topId": 숫자, "bottomId": 숫자, "reason": 문장}]} JSON 하나만 출력한다.
                """);
        StringBuilder sb = new StringBuilder();
        sb.append("계절: ").append(in.season() == null ? "상관없음" : in.season().label)
                .append("\n상황: ").append(in.occasion() == null || in.occasion().isBlank() ? "일상" : in.occasion().trim())
                .append("\n\n상의 목록:\n");
        tops.forEach(g -> sb.append(line(g)));
        sb.append("\n하의 목록:\n");
        bottoms.forEach(g -> sb.append(line(g)));
        AiGateway.message(messages, "user").put("content", sb.toString());
        return req;
    }

    private static String line(Garment g) {
        return "- id " + g.id + ": " + g.name + " (" + g.subType.label + ", 색 " + (g.colorName == null ? "미입력" : g.colorName)
                + ", 계절 " + (g.seasons.isEmpty() ? "미지정" : g.seasons.stream().map(s -> s.label).collect(Collectors.joining("·")))
                + (g.brand == null ? "" : ", " + g.brand) + ")\n";
    }

    private static boolean isTop(Garment g) {
        return g.category() == Category.TOP || g.category() == Category.OUTER;
    }
}
