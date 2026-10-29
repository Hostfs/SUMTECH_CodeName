package ai.otgyeol.image;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import ai.otgyeol.common.ApiException;
import ai.otgyeol.common.CurrentUser;

/** 사진 업로드와 조회. 본인 사진만 볼 수 있다. 업로드한 사진은 옷을 저장할 때 그 옷에 연결된다. */
@RestController
@RequestMapping("/api/images")
public class ImageController {

    static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    static final long MAX_BYTES = 10L * 1024 * 1024;

    public record Uploaded(long id, String url) {
    }

    private final ImageAssetRepository images;
    private final ImageProcessingRepository processings;

    public ImageController(ImageAssetRepository images, ImageProcessingRepository processings) {
        this.images = images;
        this.processings = processings;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Uploaded upload(@RequestParam("file") MultipartFile file) throws IOException {
        ImageAsset asset = store(CurrentUser.id(), file, null);
        return new Uploaded(asset.id, url(asset.id));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> get(@PathVariable long id) {
        ImageAsset asset = images.findByIdAndUserId(id, CurrentUser.id()).orElseThrow(() -> ApiException.notFound("사진"));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(asset.contentType))
                .cacheControl(CacheControl.noCache().cachePrivate())
                .body(asset.data);
    }

    public ImageAsset store(long userId, MultipartFile file, String sourceUrl) throws IOException {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("사진 파일이 비어 있어요.");
        }
        if (!ALLOWED_TYPES.contains(file.getContentType())) {
            throw ApiException.badRequest("JPG, PNG, WEBP 사진만 올릴 수 있어요.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw ApiException.badRequest("사진은 한 장에 10MB까지 올릴 수 있어요.");
        }
        ImageAsset asset = new ImageAsset();
        asset.userId = userId;
        asset.contentType = file.getContentType();
        asset.data = file.getBytes();
        asset.sourceUrl = sourceUrl;
        return images.save(asset);
    }

    public static String url(Long id) {
        return id == null ? null : "/api/images/" + id;
    }
}
