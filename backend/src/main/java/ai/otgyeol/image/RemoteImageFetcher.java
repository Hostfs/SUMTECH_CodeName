package ai.otgyeol.image;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;

import org.springframework.stereotype.Component;

import ai.otgyeol.ai.ProductSearchController;

/**
 * 사용자가 고른 제품 후보의 대표 이미지를 내려받아 이미지로 저장한다(source_url이 남아 제품 이미지 원본으로 계산된다).
 * 외부 주소이므로 공인 http(s)만 열고 리다이렉트도 매번 같은 검사를 거친다. 실패하면 빈 값을 돌려 등록은 계속된다.
 */
@Component
public class RemoteImageFetcher {

    private final ImageAssetRepository images;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    public RemoteImageFetcher(ImageAssetRepository images) {
        this.images = images;
    }

    public Optional<ImageAsset> fetch(long userId, String url) {
        if (url == null || url.length() > 1000) {
            return Optional.empty();
        }
        try {
            URI uri = URI.create(url);
            HttpResponse<byte[]> res = null;
            for (int hop = 0; hop < 4; hop++) {
                if (!ProductSearchController.isPublicHttp(uri)) {
                    return Optional.empty();
                }
                HttpRequest req = HttpRequest.newBuilder(uri)
                        .timeout(Duration.ofSeconds(8))
                        .header("User-Agent", "Mozilla/5.0 (compatible; OtgyeolBot/1.0; +product-image)")
                        .header("Accept", "image/jpeg,image/png,image/webp")
                        .GET().build();
                res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
                if (res.statusCode() / 100 != 3) {
                    break;
                }
                String location = res.headers().firstValue("Location").orElse(null);
                if (location == null) {
                    return Optional.empty();
                }
                uri = uri.resolve(location);
            }
            if (res == null || res.statusCode() / 100 != 2) {
                return Optional.empty();
            }
            String type = res.headers().firstValue("Content-Type").orElse("")
                    .split(";")[0].trim().toLowerCase(Locale.ROOT);
            byte[] body = res.body();
            if (!ImageController.ALLOWED_TYPES.contains(type) || body.length == 0 || body.length > ImageController.MAX_BYTES) {
                return Optional.empty();
            }
            ImageAsset asset = new ImageAsset();
            asset.userId = userId;
            asset.contentType = type;
            asset.data = body;
            asset.sourceUrl = url;
            return Optional.of(images.save(asset));
        } catch (IOException | IllegalArgumentException e) {
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        }
    }
}
