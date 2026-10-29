package ai.otgyeol.weather;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.common.ApiException;
import ai.otgyeol.common.CurrentUser;
import ai.otgyeol.common.Dates;
import ai.otgyeol.garment.Season;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 현재 위치 날씨(R12). 기상청 단기예보 조회서비스의 초단기실황(지금 기온·강수)과 단기예보(오늘 최저·최고·강수확률·하늘)를
 * 서버에서 불러와 합친다. 키는 서버 환경변수 KMA_API_KEY에서만 읽고, 같은 격자는 10분 동안 다시 부르지 않는다.
 * 어떤 계절 옷을 고를지는 기온 기준표로 정하고, 실제 옷 고르기는 화면이 내 옷장 목록에서 한다.
 */
@RestController
public class WeatherController {

    private static final Logger log = LoggerFactory.getLogger(WeatherController.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
    private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HHmm");
    private static final Duration CACHE_FOR = Duration.ofMinutes(10);

    public record Weather(String observedAt, Double temperature, String sky, String precipitation, boolean raining,
            Integer humidity, Double windSpeed, Double minTemperature, Double maxTemperature, Integer rainChance,
            List<String> seasons, List<String> seasonLabels, String seasonReason) {
    }

    private record Cached(Weather weather, Instant at) {
    }

    private final String key;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    public WeatherController(@Value("${app.kma.service-key:}") String key) {
        String k = key == null ? "" : key.trim();
        // 공공데이터포털은 인코딩 키와 디코딩 키를 함께 준다. 어느 쪽을 넣어도 한 번만 인코딩되게 디코딩해 둔다.
        this.key = k.contains("%") ? URLDecoder.decode(k, StandardCharsets.UTF_8) : k;
    }

    @GetMapping("/api/weather")
    Weather weather(@RequestParam double lat, @RequestParam double lon) {
        CurrentUser.id();
        if (key.isEmpty()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "날씨 서비스가 설정되지 않아 날씨를 보여 줄 수 없어요.");
        }
        if (lat < 32.5 || lat > 39.5 || lon < 124 || lon > 132) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "기상청 예보는 국내 위치만 볼 수 있어요.");
        }
        KmaGrid.Point p = KmaGrid.of(lat, lon);
        ZonedDateTime now = ZonedDateTime.now(Dates.ZONE);
        String cacheKey = p.nx() + "," + p.ny() + "," + now.truncatedTo(ChronoUnit.HOURS);
        Cached hit = cache.get(cacheKey);
        if (hit != null && hit.at().plus(CACHE_FOR).isAfter(Instant.now())) {
            return hit.weather();
        }
        Weather w = load(p, now);
        if (cache.size() > 500) {
            cache.clear();
        }
        cache.put(cacheKey, new Cached(w, Instant.now()));
        return w;
    }

    private Weather load(KmaGrid.Point p, ZonedDateTime now) {
        // 초단기실황: 매시 정각 자료가 10분쯤 뒤에 나온다.
        ZonedDateTime ncstBase = now.minusMinutes(10).truncatedTo(ChronoUnit.HOURS);
        Map<String, String> ncst = new HashMap<>();
        for (JsonNode item : items("getUltraSrtNcst", ncstBase, p, 20)) {
            ncst.put(item.path("category").asString(), item.path("obsrValue").asString());
        }

        // 단기예보: 02시 발표분(02:10쯤 제공)에 오늘 하루 최저·최고가 들어 있다. 그 전이면 전날 23시 발표분을 쓴다.
        LocalDate today = now.toLocalDate();
        ZonedDateTime fcstBase = now.isBefore(now.withHour(2).withMinute(15).withSecond(0))
                ? now.minusDays(1).withHour(23).withMinute(0)
                : now.withHour(2).withMinute(0);
        String todayYmd = today.format(YMD);
        String nowHour = now.truncatedTo(ChronoUnit.HOURS).format(HM);
        Double min = null;
        Double max = null;
        Integer pop = null;
        String skyCode = null;
        for (JsonNode item : items("getVilageFcst", fcstBase, p, 1000)) {
            if (!todayYmd.equals(item.path("fcstDate").asString())) {
                continue;
            }
            String cat = item.path("category").asString();
            String time = item.path("fcstTime").asString();
            String value = item.path("fcstValue").asString();
            switch (cat) {
                case "TMN" -> min = number(value);
                case "TMX" -> max = number(value);
                case "POP" -> {
                    if (time.compareTo(nowHour) >= 0) {
                        Double v = number(value);
                        if (v != null && (pop == null || v > pop)) {
                            pop = v.intValue();
                        }
                    }
                }
                case "SKY" -> {
                    if (skyCode == null && time.compareTo(nowHour) >= 0) {
                        skyCode = value;
                    }
                }
                default -> {
                }
            }
        }

        Double temp = number(ncst.get("T1H"));
        String pty = ncst.getOrDefault("PTY", "0");
        Double hum = number(ncst.get("REH"));
        // 옷 고르기 기준 기온: 오늘 최저·최고가 있으면 그 평균, 없으면 지금 기온.
        Double basis = min != null && max != null ? (min + max) / 2 : temp;
        List<Season> seasons = seasonsFor(basis);
        String reason = basis == null ? "기온을 받지 못해 이번 달 계절로 골랐어요."
                : String.format("오늘 평균 %.0f°C 기준", basis);
        return new Weather(ncstBase.format(DateTimeFormatter.ofPattern("HH:mm")), temp, skyLabel(skyCode), ptyLabel(pty),
                !"0".equals(pty), hum == null ? null : hum.intValue(), number(ncst.get("WSD")), min, max, pop,
                seasons.stream().map(Enum::name).toList(), seasons.stream().map(s -> s.label).toList(), reason);
    }

    /** 기온 기준표: 23°C 이상 여름, 12~22°C 봄·가을, 5~11°C 가을·겨울, 5°C 미만 겨울. */
    static List<Season> seasonsFor(Double t) {
        if (t == null) {
            return List.of(Dates.currentSeason());
        }
        if (t >= 23) {
            return List.of(Season.SUMMER);
        }
        if (t >= 12) {
            return List.of(Season.SPRING, Season.AUTUMN);
        }
        if (t >= 5) {
            return List.of(Season.AUTUMN, Season.WINTER);
        }
        return List.of(Season.WINTER);
    }

    private List<JsonNode> items(String op, ZonedDateTime base, KmaGrid.Point p, int rows) {
        String url = BASE + "/" + op + "?serviceKey=" + URLEncoder.encode(key, StandardCharsets.UTF_8)
                + "&pageNo=1&numOfRows=" + rows + "&dataType=JSON&base_date=" + base.format(YMD)
                + "&base_time=" + base.format(HM) + "&nx=" + p.nx() + "&ny=" + p.ny();
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).GET().build();
        String body;
        try {
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            body = res.body();
        } catch (IOException e) {
            log.warn("기상청 호출 실패 {}: {}", op, e.toString());
            throw unavailable();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw unavailable();
        }
        // 키 오류 등은 JSON이 아니라 XML로 온다.
        if (body == null || !body.trim().startsWith("{")) {
            log.warn("기상청 응답이 JSON이 아님 {}: {}", op, body == null ? "" : body.substring(0, Math.min(200, body.length())));
            throw unavailable();
        }
        JsonNode root = JSON.readTree(body).path("response");
        String code = root.path("header").path("resultCode").asString();
        if (!"00".equals(code)) {
            log.warn("기상청 결과 코드 {} {}: {}", op, code, root.path("header").path("resultMsg").asString());
            throw unavailable();
        }
        List<JsonNode> out = new ArrayList<>();
        root.path("body").path("items").path("item").forEach(out::add);
        return out;
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "기상청 날씨를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }

    private static Double number(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            double d = Double.parseDouble(v);
            // 기상청은 누락 값을 -998.9·900 이상 같은 값으로 준다.
            return d <= -900 || d >= 900 ? null : d;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String skyLabel(String code) {
        if (code == null) {
            return null;
        }
        return switch (code) {
            case "1" -> "맑음";
            case "3" -> "구름많음";
            case "4" -> "흐림";
            default -> null;
        };
    }

    private static String ptyLabel(String code) {
        return switch (code) {
            case "1" -> "비";
            case "2" -> "비 또는 눈";
            case "3" -> "눈";
            case "5" -> "빗방울";
            case "6" -> "빗방울·눈날림";
            case "7" -> "눈날림";
            default -> "없음";
        };
    }
}
