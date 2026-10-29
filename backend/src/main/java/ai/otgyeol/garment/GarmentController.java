package ai.otgyeol.garment;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.common.CurrentUser;
import ai.otgyeol.garment.GarmentDtos.ConfirmPlacementInput;
import ai.otgyeol.garment.GarmentDtos.GarmentDetail;
import ai.otgyeol.garment.GarmentDtos.GarmentInput;
import ai.otgyeol.garment.GarmentDtos.GarmentSummary;
import ai.otgyeol.garment.GarmentDtos.StatusInput;

@RestController
@RequestMapping("/api/garments")
public class GarmentController {

    private final GarmentService service;

    public GarmentController(GarmentService service) {
        this.service = service;
    }

    /** 내 옷장 목록. q로 이름·브랜드·색상·종류·위치 경로를 검색한다. 묶기·정렬은 화면에서 한다. */
    @GetMapping
    List<GarmentSummary> list(@RequestParam(value = "q", required = false) String q) {
        return service.list(CurrentUser.id(), q);
    }

    @GetMapping("/{id}")
    GarmentDetail detail(@PathVariable long id) {
        return service.detail(CurrentUser.id(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    GarmentDetail create(@Valid @RequestBody GarmentInput body) {
        return service.create(CurrentUser.id(), body);
    }

    @PutMapping("/{id}")
    GarmentDetail update(@PathVariable long id, @Valid @RequestBody GarmentInput body) {
        return service.update(CurrentUser.id(), id, body);
    }

    @PatchMapping("/{id}/status")
    GarmentDetail status(@PathVariable long id, @Valid @RequestBody StatusInput body) {
        return service.updateStatus(CurrentUser.id(), id, body);
    }

    @PostMapping("/{id}/confirm-placement")
    GarmentDetail confirmPlacement(@PathVariable long id, @RequestBody(required = false) ConfirmPlacementInput body) {
        return service.confirmPlacement(CurrentUser.id(), id, body == null ? null : body.spaceId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable long id) {
        service.delete(CurrentUser.id(), id);
    }
}
