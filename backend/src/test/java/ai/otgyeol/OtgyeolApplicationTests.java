package ai.otgyeol;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 시드 데이터로 등록·분류·배치·관리·코디 API가 같은 의류 ID로 이어지는지 실제 HTTP와 MariaDB로 확인한다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(CleanDatabaseConfig.class)
class OtgyeolApplicationTests {

    @LocalServerPort
    int port;

    final JsonMapper json = JsonMapper.builder().build();

    record Res(int status, JsonNode body, String raw) {
    }

    class Client {
        final HttpClient http = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();

        Res send(String method, String path, String body) throws Exception {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
            if (body != null) {
                b.header("Content-Type", "application/json");
            }
            b.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
            HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            String t = r.body().trim();
            JsonNode node = t.startsWith("{") || t.startsWith("[") ? json.readTree(t) : null;
            return new Res(r.statusCode(), node, r.body());
        }

        Res get(String path) throws Exception {
            return send("GET", path, null);
        }

        Res post(String path, String body) throws Exception {
            return send("POST", path, body);
        }

        /** multipart 요청. png가 null이면 파일 없이 text 칸 하나만 보낸다. */
        Res multipart(String path, byte[] png) throws Exception {
            String boundary = "----otgyeol" + System.nanoTime();
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            if (png != null) {
                out.write(("Content-Disposition: form-data; name=\"file\"; filename=\"a.png\"\r\nContent-Type: image/png\r\n\r\n")
                        .getBytes(StandardCharsets.UTF_8));
                out.write(png);
            } else {
                out.write("Content-Disposition: form-data; name=\"failed\"\r\n\r\n1".getBytes(StandardCharsets.UTF_8));
            }
            out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            HttpRequest req = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(out.toByteArray())).build();
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            String t = r.body().trim();
            return new Res(r.statusCode(), t.startsWith("{") || t.startsWith("[") ? json.readTree(t) : null, r.body());
        }

        Client login() throws Exception {
            assertThat(post("/api/auth/login", "{\"email\":\"student@example.com\",\"password\":\"loopthon-2026\"}").status())
                    .isEqualTo(200);
            return this;
        }
    }

    JsonNode find(JsonNode array, String name) {
        for (JsonNode n : array) {
            JsonNode target = n.has("summary") ? n.get("summary") : n.has("garment") ? n.get("garment") : n;
            if (name.equals(target.get("name").asString())) {
                return n;
            }
        }
        throw new AssertionError(name + " not found in " + array);
    }

    static String today(int plusDays) {
        return LocalDate.now(ZoneId.of("Asia/Seoul")).plusDays(plusDays).toString();
    }

    @Test
    void healthIsPublicAndReportsRelease() throws Exception {
        Res r = new Client().get("/__health");
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("releaseId").asString()).isEqualTo("test-release");
    }

    @Test
    void apiRequiresLoginAndUnknownPathIs404() throws Exception {
        Client c = new Client();
        assertThat(c.get("/api/garments").status()).isEqualTo(401);
        assertThat(c.get("/no-such-page").status()).isEqualTo(404);
    }

    @Test
    void metaComesFromDomainTables() throws Exception {
        JsonNode meta = new Client().login().get("/api/meta").body();
        assertThat(meta.get("subTypes").size()).isEqualTo(15);
        assertThat(meta.get("fibers").toString()).contains("폴리에스터");
        assertThat(meta.get("spaceTypes").get(0).get("label").asString()).isEqualTo("걸기");
    }

    @Test
    void signupValidatesAndSeparatesAccounts() throws Exception {
        Client c = new Client();
        assertThat(c.post("/api/auth/signup", "{\"email\":\"bad\",\"password\":\"short\"}").status()).isEqualTo(400);
        String email = "new" + System.nanoTime() + "@example.com";
        assertThat(c.post("/api/auth/signup", "{\"email\":\"" + email + "\",\"password\":\"password123\"}").status())
                .isEqualTo(201);
        assertThat(c.get("/api/auth/me").body().get("email").asString()).isEqualTo(email);
        assertThat(c.get("/api/garments").body().size()).isZero();

        Client seed = new Client().login();
        // 세탁·수선과 무관한 옷으로 확인한다(세탁 중인 옷은 위치 확정 자체가 409로 먼저 막힌다)
        long seedGarment = find(seed.get("/api/garments").body(), "그레이 울 재킷").get("id").asLong();
        assertThat(c.get("/api/garments/" + seedGarment).status()).isEqualTo(404);

        // 새 계정의 공간에 시드 계정의 옷을 놓을 수 없다(서버가 404, DB 트리거가 최종 방어)
        long otherSpace = c.post("/api/spaces", "{\"name\":\"남의 행거\",\"spaceType\":\"HANG\"}").body()
                .get("spaces").get(0).get("id").asLong();
        assertThat(seed.post("/api/garments/" + seedGarment + "/confirm-placement", "{\"spaceId\":" + otherSpace + "}").status())
                .isEqualTo(404);

        assertThat(new Client().post("/api/auth/login", "{\"email\":\"" + email + "\",\"password\":\"wrongpass1\"}").status())
                .isEqualTo(401);
    }

    @Test
    void registerWithMaterialsAndClassify() throws Exception {
        Client c = new Client().login();
        Res bad = c.post("/api/garments", "{\"name\":\"테스트 셔츠\",\"subType\":\"SHIRT\",\"materials\":["
                + "{\"part\":\"SHELL\",\"fiber\":\"COTTON\",\"percent\":60},{\"part\":\"SHELL\",\"fiber\":\"POLYESTER\",\"percent\":30}]}");
        assertThat(bad.status()).isEqualTo(400);
        assertThat(bad.body().get("error").asString()).contains("100%");

        Res created = c.post("/api/garments", "{\"name\":\"테스트 셔츠\",\"subType\":\"SHIRT\",\"brand\":\"샘플\","
                + "\"seasons\":[\"SPRING\"],\"collections\":[\"출근\"],\"aiFields\":[\"BRAND\",\"MATERIAL\"],"
                + "\"careLines\":[\"30도 이하 물세탁\",\"표백 금지\"],"
                + "\"measurements\":[{\"part\":\"TOTAL_LENGTH\",\"kind\":\"LENGTH\",\"valueCm\":73}],"
                + "\"materials\":[{\"part\":\"SHELL\",\"fiber\":\"COTTON\",\"percent\":60},{\"part\":\"SHELL\",\"fiber\":\"POLYESTER\",\"percent\":40}]}");
        assertThat(created.status()).isEqualTo(201);
        JsonNode d = created.body();
        long id = d.get("summary").get("id").asLong();
        assertThat(d.get("summary").get("categoryLabel").asString()).isEqualTo("상의");
        assertThat(d.get("summary").get("templateLabel").asString()).isEqualTo("긴소매 상의");
        assertThat(d.get("summary").get("collections").toString()).contains("출근");
        assertThat(d.get("summary").get("totalLengthCm").asDouble()).isEqualTo(73.0);
        assertThat(d.get("materials").get(0).get("fiberLabel").asString()).isEqualTo("면");
        assertThat(d.get("careLines").get(1).asString()).isEqualTo("표백 금지");
        assertThat(d.get("aiFields").toString()).contains("BRAND", "MATERIAL");

        // 사용자가 브랜드를 고치면 그 항목은 AI 값 목록에서 빠지고 소재는 그대로 남는다
        Res edited = c.send("PUT", "/api/garments/" + id, "{\"name\":\"테스트 셔츠\",\"subType\":\"SHIRT\",\"brand\":\"고친 브랜드\","
                + "\"seasons\":[\"SPRING\"],\"collections\":[\"출근\"],\"careLines\":[\"30도 이하 물세탁\",\"표백 금지\"],"
                + "\"measurements\":[{\"part\":\"TOTAL_LENGTH\",\"kind\":\"LENGTH\",\"valueCm\":73}],"
                + "\"materials\":[{\"part\":\"SHELL\",\"fiber\":\"COTTON\",\"percent\":60},{\"part\":\"SHELL\",\"fiber\":\"POLYESTER\",\"percent\":40}]}");
        assertThat(edited.body().get("aiFields").toString()).contains("MATERIAL").doesNotContain("BRAND");
    }

    static byte[] png(int rgb) throws Exception {
        java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(8, 8, java.awt.image.BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < 8; x++) {
            for (int y = 0; y < 8; y++) {
                img.setRGB(x, y, rgb);
            }
        }
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    void coverImageProcessingKeepsOriginalAndCanRetry() throws Exception {
        Client c = new Client().login();
        long original = c.multipart("/api/images", png(0x1f2a44)).body().get("id").asLong();
        JsonNode created = c.post("/api/garments", "{\"name\":\"사진 셔츠\",\"subType\":\"SHIRT\",\"imageIds\":[" + original + "]}").body();
        long id = created.get("summary").get("id").asLong();
        assertThat(created.get("coverImageId").asLong()).isEqualTo(original);
        assertThat(created.get("images").get(0).get("processing").isNull()).isTrue();
        String path = "/api/garments/" + id + "/images/" + original + "/processing";

        // 성공: 정리본이 대표가 되고 원본은 그대로 남는다
        JsonNode done = c.multipart(path, png(0xffffff)).body();
        long result = done.get("coverImageId").asLong();
        assertThat(result).isNotEqualTo(original);
        assertThat(done.get("summary").get("imageUrl").asString()).isEqualTo("/api/images/" + result);
        assertThat(imageById(done.get("images"), original).get("processing").asString()).isEqualTo("DONE");
        JsonNode processed = imageById(done.get("images"), result);
        assertThat(processed.get("kind").asString()).isEqualTo("PROCESSED");
        assertThat(processed.get("processedFromId").asLong()).isEqualTo(original);
        assertThat(c.get("/api/images/" + original).status()).isEqualTo(200);

        // 다시 처리했는데 실패: 이전 정리본은 지워지고 원본이 대표로 돌아온다
        JsonNode failed = c.multipart(path, null).body();
        assertThat(failed.get("coverImageId").asLong()).isEqualTo(original);
        assertThat(failed.get("images").size()).isEqualTo(1);
        assertThat(failed.get("images").get(0).get("processing").asString()).isEqualTo("FAILED");
        assertThat(c.get("/api/images/" + result).status()).isEqualTo(404);

        // 정리본을 다시 정리하거나 남의 옷 사진을 처리할 수 없다
        long again = c.multipart(path, png(0xeeeeee)).body().get("coverImageId").asLong();
        assertThat(c.multipart("/api/garments/" + id + "/images/" + again + "/processing", null).status()).isEqualTo(400);
        Client other = new Client();
        other.post("/api/auth/signup", "{\"email\":\"img" + System.nanoTime() + "@example.com\",\"password\":\"password123\"}");
        assertThat(other.multipart(path, null).status()).isEqualTo(404);
    }

    static JsonNode imageById(JsonNode images, long imageId) {
        for (JsonNode n : images) {
            if (n.get("id").asLong() == imageId) {
                return n;
            }
        }
        throw new AssertionError(imageId + " not found in " + images);
    }

    @Test
    void seededClosetFlowsShareOneGarmentId() throws Exception {
        Client c = new Client().login();

        JsonNode list = c.get("/api/garments").body();
        assertThat(list.size()).isGreaterThanOrEqualTo(7);
        JsonNode denim = find(list, "연청 데님 팬츠");
        assertThat(denim.get("locationPath").isNull()).isTrue();
        assertThat(find(list, "베이지 니트").get("statusLabel").asString()).isEqualTo("세탁 중");
        assertThat(find(list, "베이지 니트").get("locationPath").isNull()).isTrue();
        assertThat(find(list, "네이비 옥스퍼드 셔츠").get("locationPath").asString()).isEqualTo("옷장 A → 왼쪽 행거");

        // 분류 수정: 계절 추가가 저장되고 다시 읽어도 유지된다
        long teeId = find(list, "화이트 반소매 티셔츠").get("id").asLong();
        assertThat(c.send("PUT", "/api/garments/" + teeId,
                "{\"name\":\"화이트 반소매 티셔츠\",\"colorName\":\"화이트\",\"colorHex\":\"#f4f4ef\",\"subType\":\"SHORT_SLEEVE_TEE\","
                        + "\"seasons\":[\"SUMMER\",\"SPRING\"],\"materials\":[{\"part\":\"SHELL\",\"fiber\":\"COTTON\",\"percent\":100}]}")
                .status()).isEqualTo(200);
        assertThat(c.get("/api/garments/" + teeId).body().get("summary").get("seasons").toString()).contains("SPRING", "SUMMER");
        assertThat(c.send("PUT", "/api/garments/" + teeId, "{\"name\":\" \",\"subType\":\"SHORT_SLEEVE_TEE\"}").status())
                .isEqualTo(400);

        // 공간 추가 → 배치 추천은 미확정 → 배치 완료 후 위치 검색
        assertThat(c.post("/api/spaces", "{\"name\":\"현관 행거\",\"spaceType\":\"HANG\",\"capacity\":3}").status()).isEqualTo(201);
        assertThat(c.post("/api/spaces", "{\"name\":\"\",\"spaceType\":\"HANG\",\"capacity\":0}").status()).isEqualTo(400);
        JsonNode proposals = c.post("/api/placements/recommend", null).body();
        JsonNode denimProposal = find(proposals, "연청 데님 팬츠");
        assertThat(denimProposal.get("spacePath").asString()).isEqualTo("서랍장 → 2단");
        long denimId = denimProposal.get("garment").get("id").asLong();
        assertThat(c.get("/api/garments/" + denimId).body().get("summary").get("locationPath").isNull()).isTrue();
        c.post("/api/placements/" + denimProposal.get("id").asLong() + "/apply", null);
        JsonNode search = c.get("/api/garments?q=" + URLEncoder.encode("연청", StandardCharsets.UTF_8)).body();
        assertThat(search.size()).isEqualTo(1);
        assertThat(search.get(0).get("locationPath").asString()).isEqualTo("서랍장 → 2단");
        assertThat(c.get("/api/placements").body().toString()).doesNotContain("연청 데님 팬츠");

        // 관리함: 기한 지남 → 회수 완료 → 위치 미확인 → 재배치 확인
        JsonNode board = c.get("/api/care").body();
        JsonNode overdue = find(board.get("overdue"), "베이지 니트");
        assertThat(find(board.get("dueToday"), "카키 치노 팬츠")).isNotNull();
        long knitId = overdue.get("garment").get("id").asLong();
        assertThat(overdue.get("garment").get("usable").asBoolean()).isFalse();
        assertThat(c.send("PATCH", "/api/garments/" + knitId + "/status", "{\"status\":\"STORED\"}").status()).isEqualTo(409);
        JsonNode afterComplete = c.post("/api/care/" + overdue.get("care").get("id").asLong() + "/complete", null).body();
        assertThat(afterComplete.get("overdue").toString()).doesNotContain("베이지 니트");
        JsonNode knit = c.get("/api/garments/" + knitId).body();
        assertThat(knit.get("summary").get("status").asString()).isEqualTo("RETURNED_UNPLACED");
        assertThat(knit.get("summary").get("locationPath").isNull()).isTrue();
        assertThat(knit.get("suggestedLocationPath").asString()).isEqualTo("서랍장 → 2단");
        assertThat(knit.get("careHistory").get(0).get("completedAt").isNull()).isFalse();
        JsonNode confirmed = c.post("/api/garments/" + knitId + "/confirm-placement", null).body();
        assertThat(confirmed.get("summary").get("status").asString()).isEqualTo("STORED");
        assertThat(confirmed.get("summary").get("locationPath").asString()).isEqualTo("서랍장 → 2단");

        // 세탁 맡기기: 예정일이 맡긴 날보다 앞서면 거부, 맡기면 세탁 중이 되고 진행 중 목록에 보인다
        long shirtId = find(list, "네이비 옥스퍼드 셔츠").get("id").asLong();
        assertThat(c.post("/api/garments/" + shirtId + "/care",
                "{\"careType\":\"WASH\",\"place\":\"SHOP\",\"shopName\":\"동네 세탁소\",\"dueOn\":\"" + today(-1) + "\"}").status())
                .isEqualTo(400);
        assertThat(c.post("/api/garments/" + shirtId + "/care",
                "{\"careType\":\"WASH\",\"place\":\"HOME\",\"shopName\":\"동네 세탁소\",\"dueOn\":\"" + today(1) + "\"}").status())
                .isEqualTo(400);
        JsonNode careBoard = c.post("/api/garments/" + shirtId + "/care",
                "{\"careType\":\"WASH\",\"place\":\"SHOP\",\"shopName\":\"동네 세탁소\",\"dueOn\":\"" + today(1) + "\"}").body();
        JsonNode shirtCare = find(careBoard.get("inProgress"), "네이비 옥스퍼드 셔츠");
        assertThat(shirtCare.get("garment").get("statusLabel").asString()).isEqualTo("세탁 중");
        assertThat(shirtCare.get("care").get("dueOn").asString()).isEqualTo(today(1));
        assertThat(c.post("/api/garments/" + shirtId + "/care",
                "{\"careType\":\"REPAIR\",\"place\":\"HOME\",\"dueOn\":\"" + today(1) + "\"}").status()).isEqualTo(409);
        // 옷장 지도에서도 세탁 중인 셔츠는 행거에 없는 것으로 보인다(같은 상태를 모든 화면이 공유)
        JsonNode map = c.get("/api/spaces").body();
        assertThat(map.toString()).doesNotContain("\"name\":\"네이비 옥스퍼드 셔츠\"");

        // 코디 저장: 상의·하의 종류를 확인하고 같은 의류 ID로 다시 열린다
        long jacketId = find(list, "그레이 울 재킷").get("id").asLong();
        long slacksId = find(list, "블랙 슬랙스").get("id").asLong();
        assertThat(c.post("/api/outfits", "{\"name\":\"뒤집힌 코디\",\"topId\":" + slacksId + ",\"bottomId\":" + jacketId + "}")
                .status()).isEqualTo(400);
        JsonNode outfits = c.post("/api/outfits", "{\"name\":\"출근 코디\",\"topId\":" + jacketId + ",\"bottomId\":" + slacksId + "}")
                .body();
        assertThat(outfits.get(0).get("top").get("id").asLong()).isEqualTo(jacketId);
        assertThat(outfits.get(0).get("bottom").get("id").asLong()).isEqualTo(slacksId);
        assertThat(outfits.get(0).get("top").get("template").asString()).isEqualTo("JACKET");

        assertThat(c.send("PUT", "/api/body", "{\"heightCm\":185}").body().get("heightCm").asDouble()).isEqualTo(185.0);
        assertThat(c.send("PUT", "/api/body", "{\"heightCm\":20}").status()).isEqualTo(400);
    }
}
