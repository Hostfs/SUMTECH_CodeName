package ai.otgyeol.space;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.common.CurrentUser;
import ai.otgyeol.space.PlacementService.ProposalView;

@RestController
@RequestMapping("/api/placements")
public class PlacementController {

    public record RecommendInput(List<Long> garmentIds) {
    }

    public record ChangeInput(@NotNull(message = "공간을 골라 주세요.") Long spaceId) {
    }

    private final PlacementService service;

    public PlacementController(PlacementService service) {
        this.service = service;
    }

    @GetMapping
    List<ProposalView> pending() {
        return service.pending(CurrentUser.id());
    }

    @PostMapping("/recommend")
    List<ProposalView> recommend(@RequestBody(required = false) RecommendInput body) {
        return service.recommend(CurrentUser.id(), body == null ? null : body.garmentIds());
    }

    @PutMapping("/{id}")
    List<ProposalView> change(@PathVariable long id, @Valid @RequestBody ChangeInput body) {
        return service.change(CurrentUser.id(), id, body.spaceId());
    }

    @PostMapping("/{id}/apply")
    List<ProposalView> apply(@PathVariable long id) {
        return service.apply(CurrentUser.id(), id);
    }

    @DeleteMapping("/{id}")
    List<ProposalView> dismiss(@PathVariable long id) {
        return service.dismiss(CurrentUser.id(), id);
    }
}
