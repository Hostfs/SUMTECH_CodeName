package ai.otgyeol.image;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.common.ApiException;

/**
 * 다른 사이트의 상품 이미지를 브라우저가 직접 읽지 못할 때(CORS) 서버가 대신 내려받아 돌려준다. 저장하지 않는다.
 * 화면은 받은 사진으로 배경을 지운 뒤 /api/images로 올린다. 공인 주소·JPG/PNG/WEBP·10MB만 허용한다.
 */
@RestController
public class ImageProxyController {

    private final RemoteImageFetcher fetcher;

    public ImageProxyController(RemoteImageFetcher fetcher) {
        this.fetcher = fetcher;
    }

    @GetMapping("/api/image-proxy")
    ResponseEntity<byte[]> proxy(@RequestParam("url") String url) {
        RemoteImageFetcher.Downloaded d = fetcher.download(url.trim()).orElseThrow(() -> ApiException.badRequest(
                "이 주소에서 이미지를 가져오지 못했어요. 공개된 JPG·PNG·WEBP 이미지 주소(10MB 이하)인지 확인해 주세요."));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(d.contentType()))
                .cacheControl(CacheControl.noStore())
                .body(d.data());
    }
}
