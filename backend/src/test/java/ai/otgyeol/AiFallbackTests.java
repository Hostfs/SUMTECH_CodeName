package ai.otgyeol;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

import ai.otgyeol.ai.ProductSearchController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * AI 키가 없을 때(테스트 환경)도 등록을 끝낼 수 있는지 확인한다: 택 판독은 실패 기록과 함께 직접 입력으로 이어지고,
 * 제품 검색은 실패로 기록되며, 옷 상세에 택 사진과 검색 결과가 남는다. 실제 AI 호출은 E2E에서 주최 측 키로 확인한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.ai.gateway-key=")
@Import(CleanDatabaseConfig.class)
class AiFallbackTests {

    @LocalServerPort
    int port;

    final JsonMapper json = JsonMapper.builder().build();
    final HttpClient http = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();

    // 1x1 PNG
    static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    HttpResponse<String> send(HttpRequest.Builder b) throws Exception {
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    HttpRequest.Builder req(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
    }

    JsonNode postJson(String path, String body) throws Exception {
        HttpResponse<String> r = send(req(path).header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)));
        return json.readTree(r.body());
    }

    @Test
    void registrationCompletesWithoutAiKey() throws Exception {
        send(req("/api/auth/login").header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"student@example.com\",\"password\":\"loopthon-2026\"}")));

        String boundary = "----otgyeol" + System.nanoTime();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        for (String name : new String[] { "care.png", "brand.png" }) {
            body.writeBytes(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"files\"; filename=\"" + name
                    + "\"\r\nContent-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.writeBytes(PNG);
            body.writeBytes("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        body.writeBytes(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        HttpResponse<String> analyzed = send(req("/api/labels/analyze")
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())));
        assertThat(analyzed.statusCode()).isEqualTo(200);
        JsonNode a = json.readTree(analyzed.body());
        assertThat(a.get("extraction").get("status").asString()).isEqualTo("FAILED");
        assertThat(a.get("extraction").get("errorMessage").asString()).contains("AI 키");
        assertThat(a.get("extraction").get("imageIds").size()).isEqualTo(2);
        assertThat(a.get("unread").toString()).contains("BRAND", "MATERIAL");
        long extractionId = a.get("extraction").get("id").asLong();

        JsonNode search = postJson("/api/products/search", "{\"extractionId\":" + extractionId + ",\"brand\":\"샘플\",\"productCode\":\"AB-123\"}");
        assertThat(search.get("status").asString()).isEqualTo("FAILED");
        assertThat(search.get("candidates").size()).isZero();

        JsonNode created = postJson("/api/garments", "{\"name\":\"등록 테스트 셔츠\",\"subType\":\"SHIRT\",\"brand\":\"샘플\",\"extractionId\":" + extractionId + "}");
        JsonNode detail = json.readTree(send(req("/api/garments/" + created.get("summary").get("id").asLong())).body());
        assertThat(detail.get("summary").get("name").asString()).isEqualTo("등록 테스트 셔츠");
        assertThat(detail.get("images").size()).isEqualTo(2);
        assertThat(detail.get("images").get(0).get("kind").asString()).isEqualTo("LABEL");
        assertThat(detail.get("search").get("status").asString()).isEqualTo("FAILED");

    }

    @Test
    void productPageFetchRefusesInternalAddresses() {
        assertThat(ProductSearchController.isPublicHttp(URI.create("http://127.0.0.1/admin"))).isFalse();
        assertThat(ProductSearchController.isPublicHttp(URI.create("http://localhost:3000/__health"))).isFalse();
        assertThat(ProductSearchController.isPublicHttp(URI.create("http://169.254.169.254/latest/meta-data"))).isFalse();
        assertThat(ProductSearchController.isPublicHttp(URI.create("http://10.0.0.5/"))).isFalse();
        assertThat(ProductSearchController.isPublicHttp(URI.create("file:///etc/passwd"))).isFalse();
    }
}
