package ai.otgyeol.health;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 대시보드와 주최 측 실행이 확인하는 배포 상태 경로. 로그인 없이 200을 준다. */
@RestController
public class HealthController {

    private final String releaseId;

    public HealthController(@Value("${app.release-id}") String releaseId) {
        this.releaseId = releaseId;
    }

    @GetMapping("/__health")
    ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("releaseId", releaseId));
    }
}
