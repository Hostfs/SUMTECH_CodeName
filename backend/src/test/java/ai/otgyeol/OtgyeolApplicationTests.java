package ai.otgyeol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.CookieManager;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** 시드 데이터로 등록·분류·배치·관리·코디 API가 같은 의류 ID로 이어지는지 실제 HTTP와 MariaDB로 확인한다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(CleanDatabaseConfig.class)
class OtgyeolApplicationTests {

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

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

    @Test
    void placeGarmentsDirectlyAndOnRegister() throws Exception {
        Client c = new Client();
        c.post("/api/auth/signup", "{\"email\":\"place" + System.nanoTime() + "@example.com\",\"password\":\"password123\"}");
        long closet = c.post("/api/spaces", "{\"name\":\"옷장 A\",\"spaceType\":\"HANG\"}").body().get("spaces").get(0).get("id").asLong();
        JsonNode map = c.post("/api/spaces", "{\"name\":\"왼쪽 행거\",\"parentId\":" + closet + ",\"spaceType\":\"HANG\",\"capacity\":1}").body();
        long hanger = find(map.get("spaces"), "왼쪽 행거").get("id").asLong();

        // 등록할 때 공간을 고르면 바로 그 위치로 확정된다
        JsonNode created = c.post("/api/garments", "{\"name\":\"등록 셔츠\",\"subType\":\"SHIRT\",\"spaceId\":" + hanger + "}").body();
        assertThat(created.get("summary").get("locationPath").asString()).isEqualTo("옷장 A → 왼쪽 행거");
        assertThat(c.post("/api/garments", "{\"name\":\"바깥 셔츠\",\"subType\":\"SHIRT\",\"spaceId\":" + closet + "}").status())
                .isEqualTo(400);

        // 옷장 지도에서 추천 없이 고른 옷을 바로 넣는다. 용량을 넘기면 초과 수량이 보인다
        long tee = c.post("/api/garments", "{\"name\":\"미배치 티\",\"subType\":\"SHORT_SLEEVE_TEE\"}").body().get("summary").get("id").asLong();
        assertThat(c.get("/api/spaces").body().get("unplaced").toString()).contains("미배치 티");
        JsonNode after = c.post("/api/spaces/" + hanger + "/garments", "{\"garmentIds\":[" + tee + "]}").body();
        assertThat(after.get("unplaced").size()).isZero();
        JsonNode hangerView = find(after.get("spaces"), "왼쪽 행거");
        assertThat(hangerView.get("count").asInt()).isEqualTo(2);
        assertThat(hangerView.get("overBy").asInt()).isEqualTo(1);
        assertThat(c.post("/api/spaces/" + closet + "/garments", "{\"garmentIds\":[" + tee + "]}").status()).isEqualTo(400);
        assertThat(c.post("/api/spaces/" + hanger + "/garments", "{\"garmentIds\":[]}").status()).isEqualTo(400);

        // 세탁 중인 옷은 넣을 수 없다
        c.post("/api/garments/" + tee + "/care", "{\"careType\":\"WASH\",\"place\":\"HOME\",\"dueOn\":\"" + today(1) + "\"}");
        assertThat(c.post("/api/spaces/" + hanger + "/garments", "{\"garmentIds\":[" + tee + "]}").status()).isEqualTo(409);
    }

    @Test
    void userCorrectionsAreKeptBesideWhatTheTagSaid() throws Exception {
        Client c = new Client();
        String email = "fix" + System.nanoTime() + "@example.com";
        c.post("/api/auth/signup", "{\"email\":\"" + email + "\",\"password\":\"password123\"}");
        // AI 키가 없는 테스트 환경이라 '택을 읽은 결과'를 DB에 직접 만든다: 브랜드·사이즈·소재는 읽었고 원산지는 못 읽음
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        jdbc.update("INSERT INTO label_extractions (user_id, status_code, raw_text, created_at) VALUES (?, 'DONE', '택', NOW(6))", userId);
        long ext = jdbc.queryForObject("SELECT MAX(id) FROM label_extractions WHERE user_id = ?", Long.class, userId);
        jdbc.update("INSERT INTO label_extraction_values (extraction_id, field_code, read_value) VALUES (?, 'BRAND', 'OTGYEOL'), "
                + "(?, 'SIZE_LABEL', 'M'), (?, 'MATERIAL', '겉감 면 60%, 겉감 폴리에스터 40%'), (?, 'ORIGIN', NULL)", ext, ext, ext, ext);

        // 사이즈를 L로 고치고 못 읽은 원산지를 채운다. 브랜드와 소재(순서만 다름)는 읽은 그대로 둔다
        JsonNode created = c.post("/api/garments", "{\"name\":\"정정 테스트\",\"subType\":\"SHIRT\",\"brand\":\"OTGYEOL\",\"sizeLabel\":\"L\","
                + "\"origin\":\"베트남\",\"materials\":[{\"part\":\"SHELL\",\"fiber\":\"POLYESTER\",\"percent\":40},"
                + "{\"part\":\"SHELL\",\"fiber\":\"COTTON\",\"percent\":60}],\"extractionId\":" + ext
                + ",\"aiFields\":[\"BRAND\",\"SIZE_LABEL\",\"MATERIAL\"]}").body();
        JsonNode values = created.get("extraction").get("values");
        assertThat(field(values, "SIZE_LABEL").get("readValue").asString()).isEqualTo("M");
        assertThat(field(values, "SIZE_LABEL").get("correctedValue").asString()).isEqualTo("L");
        assertThat(field(values, "ORIGIN").get("correctedValue").asString()).isEqualTo("베트남");
        assertThat(field(values, "BRAND").get("correctedValue").isNull()).isTrue();
        assertThat(field(values, "MATERIAL").get("correctedValue").isNull()).isTrue();
        assertThat(created.get("aiFields").toString()).contains("BRAND", "MATERIAL").doesNotContain("SIZE_LABEL");

        // 나중에 상세에서 브랜드를 고쳐도 읽은 값 옆에 고친 값이 남는다
        long id = created.get("summary").get("id").asLong();
        JsonNode updated = c.send("PUT", "/api/garments/" + id, "{\"name\":\"정정 테스트\",\"subType\":\"SHIRT\",\"brand\":\"OTGYEOL BASIC\","
                + "\"sizeLabel\":\"L\",\"origin\":\"베트남\",\"materials\":[{\"part\":\"SHELL\",\"fiber\":\"COTTON\",\"percent\":60},"
                + "{\"part\":\"SHELL\",\"fiber\":\"POLYESTER\",\"percent\":40}]}").body();
        assertThat(field(updated.get("extraction").get("values"), "BRAND").get("correctedValue").asString()).isEqualTo("OTGYEOL BASIC");
        assertThat(field(updated.get("extraction").get("values"), "BRAND").get("readValue").asString()).isEqualTo("OTGYEOL");
        assertThat(updated.get("aiFields").toString()).doesNotContain("BRAND");
    }

    static JsonNode field(JsonNode values, String code) {
        for (JsonNode v : values) {
            if (code.equals(v.get("field").asString())) {
                return v;
            }
        }
        throw new AssertionError(code + " not found in " + values);
    }

    @Test
    void moveBatchesToBoxOffsiteAndLaundry() throws Exception {
        Client c = new Client();
        c.post("/api/auth/signup", "{\"email\":\"move" + System.nanoTime() + "@example.com\",\"password\":\"password123\"}");
        long hanger = c.post("/api/spaces", "{\"name\":\"행거\",\"spaceType\":\"HANG\"}").body().get("spaces").get(0).get("id").asLong();
        long[] ids = new long[5];
        String[] names = {"여름 셔츠", "여름 반바지", "플란넬 셔츠", "후드티", "본가 코트"};
        String[] types = {"SHIRT", "SHORTS", "SHIRT", "LONG_SLEEVE_TEE", "COAT"};
        for (int i = 0; i < 5; i++) {
            ids[i] = c.post("/api/garments", "{\"name\":\"" + names[i] + "\",\"subType\":\"" + types[i] + "\",\"spaceId\":" + hanger + "}")
                    .body().get("summary").get("id").asLong();
        }
        long label = c.multipart("/api/images", png(0xffffff)).body().get("id").asLong();

        // 박스 라벨을 찍고 두 벌을 새 박스로 한 번에 옮긴다
        Res boxed = c.post("/api/moves", "{\"destination\":\"SPACE\",\"newSpace\":{\"name\":\"박스 A\",\"spaceType\":\"BOX\"},"
                + "\"garmentIds\":[" + ids[0] + "," + ids[1] + "],\"imageIds\":[" + label + "]}");
        assertThat(boxed.status()).isEqualTo(201);
        assertThat(boxed.body().get("spacePath").asString()).isEqualTo("박스 A");
        assertThat(boxed.body().get("imageUrls").size()).isEqualTo(1);
        assertThat(boxed.body().get("garments").size()).isEqualTo(2);
        JsonNode shirt = c.get("/api/garments/" + ids[0]).body().get("summary");
        assertThat(shirt.get("locationPath").asString()).isEqualTo("박스 A");
        assertThat(shirt.get("locationKind").asString()).isEqualTo("BOX");
        JsonNode inBox = c.get("/api/garments?q=" + URLEncoder.encode("박스", StandardCharsets.UTF_8)).body();
        assertThat(inBox.size()).isEqualTo(2);
        assertThat(c.post("/api/moves", "{\"destination\":\"SPACE\",\"newSpace\":{\"name\":\"행거2\",\"spaceType\":\"HANG\"},"
                + "\"garmentIds\":[" + ids[2] + "]}").status()).isEqualTo(400);

        // 집 밖(본가)으로 옮긴 옷은 집 밖으로 보이고, 배치 추천은 집 밖을 고르지 않는다
        long home = find(c.post("/api/spaces", "{\"name\":\"본가\",\"spaceType\":\"OFFSITE\"}").body().get("spaces"), "본가").get("id").asLong();
        c.post("/api/moves", "{\"destination\":\"SPACE\",\"spaceId\":" + home + ",\"garmentIds\":[" + ids[4] + "]}");
        assertThat(c.get("/api/garments/" + ids[4]).body().get("summary").get("locationKind").asString()).isEqualTo("OFFSITE");
        c.post("/api/garments", "{\"name\":\"새 바지\",\"subType\":\"PANTS\"}");
        JsonNode proposals = c.post("/api/placements/recommend", null).body();
        assertThat(find(proposals, "새 바지").get("spacePath").asString()).isNotEqualTo("본가");

        // 세탁소 영수증 묶음: 두 벌이 세탁 중이 되고 관리함에 회수 예정일과 함께 보인다
        Res laundry = c.post("/api/moves", "{\"destination\":\"LAUNDRY\",\"shopName\":\"동네 세탁소\",\"dueOn\":\"" + today(2)
                + "\",\"garmentIds\":[" + ids[2] + "," + ids[3] + "]}");
        assertThat(laundry.status()).isEqualTo(201);
        assertThat(laundry.body().get("shopName").asString()).isEqualTo("동네 세탁소");
        JsonNode board = c.get("/api/care").body();
        JsonNode flannel = find(board.get("inProgress"), "플란넬 셔츠");
        assertThat(flannel.get("care").get("dueOn").asString()).isEqualTo(today(2));
        assertThat(flannel.get("garment").get("statusLabel").asString()).isEqualTo("세탁 중");
        assertThat(flannel.get("garment").get("locationKind").asString()).isEqualTo("CARE");
        assertThat(find(board.get("inProgress"), "후드티")).isNotNull();

        // 이미 맡긴 옷은 다시 맡기거나 박스로 옮길 수 없다. 날짜 순서가 틀리면 거부한다
        assertThat(c.post("/api/moves", "{\"destination\":\"LAUNDRY\",\"dueOn\":\"" + today(2) + "\",\"garmentIds\":[" + ids[2] + "]}").status())
                .isEqualTo(409);
        // 세탁소 묶음은 회수 예정일이 있어야 관리함에 모인다
        assertThat(c.post("/api/moves", "{\"destination\":\"LAUNDRY\",\"garmentIds\":[" + ids[0] + "]}").status()).isEqualTo(400);
        assertThat(c.post("/api/moves", "{\"destination\":\"SPACE\",\"spaceId\":" + home + ",\"garmentIds\":[" + ids[3] + "]}").status())
                .isEqualTo(409);
        assertThat(c.post("/api/moves", "{\"destination\":\"LAUNDRY\",\"dueOn\":\"" + today(-1) + "\",\"garmentIds\":[" + ids[0] + "]}")
                .status()).isEqualTo(400);

        JsonNode recent = c.get("/api/moves").body();
        assertThat(recent.size()).isEqualTo(3);
        assertThat(recent.get(0).get("destination").asString()).isEqualTo("LAUNDRY");

        // 남의 옷은 옮길 수 없다
        assertThat(new Client().login().post("/api/moves", "{\"destination\":\"LAUNDRY\",\"garmentIds\":[" + ids[0] + "]}").status())
                .isEqualTo(404);
    }

    @Test
    void placementRulesSearchLinkAndConfirmMakesStored() throws Exception {
        Client c = new Client();
        c.post("/api/auth/signup", "{\"email\":\"rules" + System.nanoTime() + "@example.com\",\"password\":\"password123\"}");
        long closet = c.post("/api/spaces", "{\"name\":\"옷장 B\",\"spaceType\":\"HANG\"}").body().get("spaces").get(0).get("id").asLong();
        JsonNode map = c.post("/api/spaces", "{\"name\":\"행거\",\"parentId\":" + closet + ",\"spaceType\":\"HANG\",\"capacity\":5}").body();
        long hanger = find(map.get("spaces"), "행거").get("id").asLong();

        // R07: 옷이 들어 있는 공간 안에는 다른 공간을 만들 수 없다(옷이 위치 경로 중간에 끼지 않게)
        long shirt = c.post("/api/garments", "{\"name\":\"규칙 셔츠\",\"subType\":\"SHIRT\",\"spaceId\":" + hanger + "}").body()
                .get("summary").get("id").asLong();
        assertThat(c.post("/api/spaces", "{\"name\":\"칸\",\"parentId\":" + hanger + ",\"spaceType\":\"FOLD\"}").status()).isEqualTo(400);

        // R07: 배치 추천의 공간을 바깥 공간(안쪽에 공간이 있는 곳)으로 바꿀 수 없다
        long tee = c.post("/api/garments", "{\"name\":\"추천 티\",\"subType\":\"SHORT_SLEEVE_TEE\"}").body().get("summary").get("id").asLong();
        JsonNode proposals = c.post("/api/placements/recommend", "{\"garmentIds\":[" + tee + "]}").body();
        long proposal = proposals.get(0).get("id").asLong();
        assertThat(c.send("PUT", "/api/placements/" + proposal, "{\"spaceId\":" + closet + "}").status()).isEqualTo(400);
        assertThat(c.send("PUT", "/api/placements/" + proposal, "{\"spaceId\":" + hanger + "}").status()).isEqualTo(200);

        // R08: '착용·보관 전'이던 옷도 회수 후 '재배치 확인'을 누르면 '보관 중'이 된다
        c.send("PATCH", "/api/garments/" + shirt + "/status", "{\"status\":\"PENDING\"}");
        long care = c.post("/api/garments/" + shirt + "/care", "{\"careType\":\"WASH\",\"place\":\"HOME\",\"dueOn\":\"" + today(1) + "\"}")
                .body().get("inProgress").get(0).get("care").get("id").asLong();
        c.post("/api/care/" + care + "/complete", null);
        JsonNode confirmed = c.post("/api/garments/" + shirt + "/confirm-placement", null).body();
        assertThat(confirmed.get("summary").get("status").asString()).isEqualTo("STORED");
        assertThat(confirmed.get("summary").get("statusLabel").asString()).isEqualTo("보관 중");

        // R02: 택 분석 없이 한 검색도 옷에 남는다(결과가 없어도 '검색 결과 없음'으로 상세에 보인다)
        long searchId = jdbcInsertSearch(c);
        JsonNode linked = c.post("/api/garments", "{\"name\":\"검색만 한 셔츠\",\"subType\":\"SHIRT\",\"searchId\":" + searchId + "}").body();
        assertThat(linked.get("search").get("id").asLong()).isEqualTo(searchId);
        assertThat(linked.get("search").get("candidates").size()).isZero();
        assertThat(new Client().login().post("/api/garments", "{\"name\":\"남의 검색\",\"subType\":\"SHIRT\",\"searchId\":" + searchId + "}")
                .status()).isEqualTo(404);
    }

    @Test
    void careCompletedCheckUsesSeoulDate() throws Exception {
        // completed_at은 UTC로, dropped_on은 서울 날짜로 저장된다. 실행 시각과 관계없이 서울 00:30 회수를 확인한다.
        Client c = new Client();
        c.post("/api/auth/signup", "{\"email\":\"kst" + System.nanoTime() + "@example.com\",\"password\":\"password123\"}");
        long shirt = c.post("/api/garments", "{\"name\":\"새벽 회수 셔츠\",\"subType\":\"SHIRT\"}").body().get("summary").get("id").asLong();
        long care = c.post("/api/garments/" + shirt + "/care", "{\"careType\":\"WASH\",\"place\":\"HOME\",\"dueOn\":\"" + today(1) + "\"}")
                .body().get("inProgress").get(0).get("care").get("id").asLong();
        ZoneId seoul = ZoneId.of("Asia/Seoul");
        LocalDate today = LocalDate.now(seoul);
        String earlyToday = today.atTime(0, 30).atZone(seoul).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime().toString();
        String lateYesterday = today.minusDays(1).atTime(23, 30).atZone(seoul).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime().toString();

        // 맡긴 날 서울 23:30(전날)에 회수했다는 기록은 막힌다
        assertThatThrownBy(() -> jdbc.update("UPDATE care_events SET completed_at = ? WHERE id = ?", lateYesterday, care))
                .hasMessageContaining("ck_ce_completed");
        // 맡긴 날 서울 00:30 회수(UTC로는 전날 15:30)는 된다
        assertThat(jdbc.update("UPDATE care_events SET completed_at = ? WHERE id = ?", earlyToday, care)).isEqualTo(1);
    }

    /** AI 없이 검색 기록 한 건을 만든다(결과 없음). 로그인한 사용자의 것. */
    long jdbcInsertSearch(Client c) throws Exception {
        long userId = c.get("/api/auth/me").body().get("id").asLong();
        jdbc.update("INSERT INTO product_searches (user_id, query_brand, query_product_code, status_code, searched_at) VALUES (?, '테스트', NULL, 'SUCCEEDED', NOW(6))", userId);
        return jdbc.queryForObject("SELECT MAX(id) FROM product_searches WHERE user_id = ?", Long.class, userId);
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
    }
}
