package ai.otgyeol.ai;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * AI 결과를 잠깐 기억하는 작은 캐시(서버 메모리, 최근 것부터 최대 MAX개, TTL 동안).
 * 같은 택 사진(이미지 해시)·같은 브랜드·품번 검색은 AI를 다시 부르지 않아 팀 예산과 응답 시간을 아낀다.
 * 서버를 다시 띄우면 비워진다. 성공한 결과만 넣는다.
 */
public class ResponseCache<V> {

    private static final int MAX = 200;

    private record Entry<V>(V value, Instant expiresAt) {
    }

    private final Duration ttl;
    private final Map<String, Entry<V>> entries = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Entry<V>> eldest) {
            return size() > MAX;
        }
    };

    public ResponseCache(Duration ttl) {
        this.ttl = ttl;
    }

    public synchronized Optional<V> get(String key) {
        Entry<V> e = entries.get(key);
        if (e == null) {
            return Optional.empty();
        }
        if (e.expiresAt().isBefore(Instant.now())) {
            entries.remove(key);
            return Optional.empty();
        }
        return Optional.of(e.value());
    }

    public synchronized void put(String key, V value) {
        entries.put(key, new Entry<>(value, Instant.now().plus(ttl)));
    }

    /** 여러 바이트 덩어리(사진들)를 순서대로 이어 SHA-256 16진수로. */
    public static String sha256(byte[]... parts) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (byte[] p : parts) {
                md.update(p);
                md.update((byte) 0);
            }
            return HexFormat.of().formatHex(md.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String sha256(String text) {
        return sha256(text.getBytes(StandardCharsets.UTF_8));
    }
}
