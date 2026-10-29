package ai.otgyeol.ai;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import ai.otgyeol.common.ApiException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Vercel AI Gateway(OpenAI 호환 Chat Completions) 호출. 키는 서버 환경변수 AI_GATEWAY_API_KEY에서만 읽는다.
 * 키 없음·예산 부족·지연·실패를 사용자에게 보여 줄 문장으로 바꿔 던진다. 재시도는 하지 않는다(팀 예산 보호).
 */
@Component
public class AiGateway {

    private static final Logger log = LoggerFactory.getLogger(AiGateway.class);
    public static final JsonMapper JSON = JsonMapper.builder().build();

    private final String key;
    private static final int REASONING_TOKENS = 4000;
    private final String model;
    private final String baseUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public AiGateway(@Value("${app.ai.gateway-key:}") String key,
            @Value("${app.ai.model:google/gemini-2.5-flash}") String model,
            @Value("${app.ai.base-url:https://ai-gateway.vercel.sh/v1}") String baseUrl) {
        this.key = key == null ? "" : key.trim();
        this.model = model;
        this.baseUrl = baseUrl;
    }

    public boolean configured() {
        return !key.isEmpty();
    }

    /**
     * 요청 틀. 추론형 모델(gemini-2.5-flash 등)은 생각하는 토큰도 max_tokens에 들어가 JSON이 중간에 잘리므로
     * 출력 몫에 추론 몫(REASONING_TOKENS)을 더해 한도를 잡고, 응답은 JSON 객체로만 받는다.
     */
    public ObjectNode newRequest(int maxTokens) {
        ObjectNode req = JSON.createObjectNode();
        req.put("model", model);
        req.put("max_tokens", maxTokens + REASONING_TOKENS);
        req.putObject("response_format").put("type", "json_object");
        req.put("temperature", 0.2);
        req.putArray("messages");
        return req;
    }

    public static ObjectNode message(ArrayNode messages, String role) {
        ObjectNode m = messages.addObject();
        m.put("role", role);
        return m;
    }

    /** 요청을 보내고 첫 응답의 본문 문자열을 돌려준다. */
    public String complete(ObjectNode request, Duration timeout) {
        if (!configured()) {
            log.warn("AI Gateway 호출 안 함: AI 키(AI_GATEWAY_API_KEY)가 비어 있음");
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI 키가 설정되지 않아 AI 기능을 쓸 수 없어요. 직접 입력으로 계속할 수 있어요.");
        }
        if (request.has("tools")) {
            // 도구 호출과 JSON 형식 지정은 함께 쓸 수 없다(Gemini 400). 이때는 프롬프트의 JSON 지시와 parseObject에 맡긴다.
            request.remove("response_format");
        }
        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + "/chat/completions"))
                .timeout(timeout)
                .header("Authorization", "Bearer " + key)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(request)))
                .build();
        HttpResponse<String> res;
        try {
            res = http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (HttpTimeoutException e) {
            log.warn("AI Gateway 시간 초과({}초, 모델 {})", timeout.toSeconds(), model);
            throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "AI 응답이 늦어요. 잠시 뒤 다시 시도하거나 직접 입력해 주세요.");
        } catch (IOException e) {
            log.warn("AI Gateway 연결 실패: {}", e.toString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI 서비스에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI 요청이 중단됐어요.");
        }
        int code = res.statusCode();
        if (code == 401 || code == 403) {
            log.warn("AI Gateway 인증 거절: {}", code);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI 키가 유효하지 않거나 모델 사용이 거절됐어요. 운영진에게 키 상태를 확인해 주세요.");
        }
        if (code == 402 || code == 429) {
            log.warn("AI Gateway 한도 초과: {}", code);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI 사용 한도에 도달했어요. 직접 입력으로 계속할 수 있어요.");
        }
        if (code >= 400) {
            log.warn("AI Gateway 오류 {}: {}", code, abbreviate(res.body()));
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI 서비스가 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        }
        JsonNode body = JSON.readTree(res.body());
        JsonNode choice = body.path("choices").path(0);
        JsonNode content = choice.path("message").path("content");
        if ("length".equals(choice.path("finish_reason").asString(""))) {
            log.warn("AI 응답이 출력 한도에서 잘림(모델 {}, 사용 {})", model, body.path("usage"));
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI 응답이 너무 길어 중간에 끊겼어요. 다시 시도해 주세요.");
        }
        if (content.isMissingNode() || content.isNull()) {
            log.warn("AI Gateway 빈 응답: {}", abbreviate(res.body()));
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI가 빈 응답을 보냈어요. 다시 시도해 주세요.");
        }
        return content.asString();
    }

    /** 응답 본문에서 첫 JSON 객체를 꺼낸다(코드 블록이나 앞뒤 문장이 섞여도). */
    public static JsonNode parseObject(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            log.warn("AI 응답에 JSON 객체가 없음: {}", abbreviate(text));
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI 응답 형식이 올바르지 않아요. 다시 시도해 주세요.");
        }
        try {
            return JSON.readTree(text.substring(start, end + 1));
        } catch (RuntimeException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI 응답 형식이 올바르지 않아요. 다시 시도해 주세요.");
        }
    }

    /** JSON 문자열 값(없거나 null·빈 문자열이면 null). */
    public static String text(JsonNode node, String field, int maxLen) {
        JsonNode v = node.path(field);
        if (v.isMissingNode() || v.isNull()) {
            return null;
        }
        String s = v.asString().trim();
        if (s.isEmpty() || s.equalsIgnoreCase("null")) {
            return null;
        }
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }

    private static String abbreviate(String s) {
        return s == null ? "" : s.length() > 300 ? s.substring(0, 300) + "…" : s;
    }
}
