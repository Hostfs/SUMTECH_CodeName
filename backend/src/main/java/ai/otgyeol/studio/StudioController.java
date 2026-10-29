package ai.otgyeol.studio;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.common.ApiException;
import ai.otgyeol.common.CurrentUser;
import ai.otgyeol.garment.Category;
import ai.otgyeol.garment.ClosetContext;
import ai.otgyeol.garment.Garment;
import ai.otgyeol.garment.GarmentDtos.GarmentSummary;
import ai.otgyeol.garment.GarmentService;

/** 코디 스튜디오: 신체 치수와 저장한 상하의 조합. */
@RestController
public class StudioController {

    /** 모르는 치수는 비워 둔다. 범위 밖 값은 저장하지 않는다(DB CHECK와 같은 범위). */
    public record BodyInput(
            @DecimalMin(value = "100", message = "키는 100~230cm 사이로 입력해 주세요.") @DecimalMax(value = "230", message = "키는 100~230cm 사이로 입력해 주세요.") BigDecimal heightCm,
            @DecimalMin(value = "25", message = "어깨너비는 25~70cm 사이로 입력해 주세요.") @DecimalMax(value = "70", message = "어깨너비는 25~70cm 사이로 입력해 주세요.") BigDecimal shoulderCm,
            @DecimalMin(value = "50", message = "가슴둘레는 50~180cm 사이로 입력해 주세요.") @DecimalMax(value = "180", message = "가슴둘레는 50~180cm 사이로 입력해 주세요.") BigDecimal chestCm,
            @DecimalMin(value = "40", message = "허리둘레는 40~180cm 사이로 입력해 주세요.") @DecimalMax(value = "180", message = "허리둘레는 40~180cm 사이로 입력해 주세요.") BigDecimal waistCm,
            @DecimalMin(value = "50", message = "엉덩이둘레는 50~180cm 사이로 입력해 주세요.") @DecimalMax(value = "180", message = "엉덩이둘레는 50~180cm 사이로 입력해 주세요.") BigDecimal hipCm,
            @DecimalMin(value = "40", message = "다리 안쪽 길이는 40~110cm 사이로 입력해 주세요.") @DecimalMax(value = "110", message = "다리 안쪽 길이는 40~110cm 사이로 입력해 주세요.") BigDecimal inseamCm) {
    }

    public record BodyView(BigDecimal heightCm, BigDecimal shoulderCm, BigDecimal chestCm, BigDecimal waistCm,
            BigDecimal hipCm, BigDecimal inseamCm) {
    }

    public record OutfitInput(
            @NotBlank(message = "코디 이름을 입력해 주세요.") @Size(max = 50, message = "코디 이름은 50자까지 쓸 수 있어요.") String name,
            @NotNull(message = "상의를 골라 주세요.") Long topId,
            @NotNull(message = "하의를 골라 주세요.") Long bottomId) {
    }

    public record OutfitView(long id, String name, GarmentSummary top, GarmentSummary bottom) {
    }

    private final BodyProfileRepository bodies;
    private final OutfitRepository outfits;
    private final GarmentService garmentService;

    public StudioController(BodyProfileRepository bodies, OutfitRepository outfits, GarmentService garmentService) {
        this.bodies = bodies;
        this.outfits = outfits;
        this.garmentService = garmentService;
    }

    @GetMapping("/api/body")
    public BodyView body() {
        return bodies.findById(CurrentUser.id()).map(StudioController::view)
                .orElse(new BodyView(null, null, null, null, null, null));
    }

    @PutMapping("/api/body")
    @Transactional
    public BodyView saveBody(@Valid @RequestBody BodyInput in) {
        long userId = CurrentUser.id();
        BodyProfile b = bodies.findById(userId).orElseGet(() -> {
            BodyProfile created = new BodyProfile();
            created.userId = userId;
            return created;
        });
        b.heightCm = in.heightCm();
        b.shoulderCm = in.shoulderCm();
        b.chestCm = in.chestCm();
        b.waistCm = in.waistCm();
        b.hipCm = in.hipCm();
        b.inseamCm = in.inseamCm();
        return view(bodies.save(b));
    }

    /** 신체 치수는 선택 정보이므로 언제든 지울 수 있다. */
    @DeleteMapping("/api/body")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteBody() {
        bodies.findById(CurrentUser.id()).ifPresent(bodies::delete);
    }

    @GetMapping("/api/outfits")
    @Transactional(readOnly = true)
    public List<OutfitView> outfits() {
        long userId = CurrentUser.id();
        ClosetContext ctx = garmentService.context(userId);
        return outfits.findByUserIdOrderByIdDesc(userId).stream().map(o -> {
            List<Garment> items = o.garmentIds.stream().map(id -> garmentService.owned(userId, id)).toList();
            Garment top = items.stream().filter(StudioController::isTopRole).findFirst().orElse(null);
            Garment bottom = items.stream().filter(g -> g.category() == Category.BOTTOM).findFirst().orElse(null);
            return new OutfitView(o.id, o.name, top == null ? null : garmentService.summary(top, ctx),
                    bottom == null ? null : garmentService.summary(bottom, ctx));
        }).toList();
    }

    /** 상의(상의·아우터) 1벌과 하의 1벌. 역할은 저장하지 않고 옷의 세부 종류로 판단한다. */
    @PostMapping("/api/outfits")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public List<OutfitView> saveOutfit(@Valid @RequestBody OutfitInput in) {
        long userId = CurrentUser.id();
        Garment top = garmentService.owned(userId, in.topId());
        Garment bottom = garmentService.owned(userId, in.bottomId());
        if (!isTopRole(top)) {
            throw ApiException.badRequest("'" + top.name + "'은(는) 상의가 아니에요.");
        }
        if (bottom.category() != Category.BOTTOM) {
            throw ApiException.badRequest("'" + bottom.name + "'은(는) 하의가 아니에요.");
        }
        Outfit o = new Outfit();
        o.userId = userId;
        o.name = in.name().trim();
        o.garmentIds.add(top.id);
        o.garmentIds.add(bottom.id);
        outfits.save(o);
        return outfits();
    }

    @DeleteMapping("/api/outfits/{id}")
    @Transactional
    public List<OutfitView> deleteOutfit(@PathVariable long id) {
        long userId = CurrentUser.id();
        outfits.delete(outfits.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("코디")));
        return outfits();
    }

    static boolean isTopRole(Garment g) {
        return g.category() == Category.TOP || g.category() == Category.OUTER;
    }

    private static BodyView view(BodyProfile b) {
        return new BodyView(b.heightCm, b.shoulderCm, b.chestCm, b.waistCm, b.hipCm, b.inseamCm);
    }
}
