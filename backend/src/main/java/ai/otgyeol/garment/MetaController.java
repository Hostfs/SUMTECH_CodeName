package ai.otgyeol.garment;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.common.Dates;

/** 화면이 쓰는 선택지와 한국어 이름. DB의 도메인 테이블을 그대로 읽어 표시 이름을 한 곳에서 관리한다. */
@RestController
public class MetaController {

    public record Option(String value, String label) {
    }

    public record SubTypeOption(String value, String label, String category, String template) {
    }

    /** 도메인 테이블 이름과 정렬 순서. 화면에 보여 줄 순서가 정해진 테이블은 sort_order를 쓴다. */
    private static final Map<String, String> TABLES = Map.ofEntries(
            Map.entry("categories", "FIELD(code, 'TOP', 'OUTER', 'BOTTOM', 'DRESS', 'ETC')"),
            Map.entry("clothing_templates", "code"),
            Map.entry("seasons", "sort_order"),
            Map.entry("garment_statuses", "FIELD(code, 'STORED', 'PENDING', 'WASH_WAITING', 'WASHING', 'REPAIRING', 'RETURNED_UNPLACED')"),
            Map.entry("wear_frequencies", "sort_order"),
            Map.entry("space_types", "FIELD(code, 'HANG', 'FOLD', 'LONG_TERM', 'BOX', 'OFFSITE')"),
            Map.entry("care_types", "code DESC"),
            Map.entry("care_places", "code"),
            Map.entry("material_parts", "FIELD(code, 'SHELL', 'LINING', 'TRIM', 'FILL')"),
            Map.entry("fibers", "FIELD(code, 'OTHER'), label"),
            Map.entry("measurement_parts", "code"),
            Map.entry("measurement_kinds", "code"));

    private final JdbcTemplate jdbc;

    public MetaController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/meta")
    Map<String, Object> meta() {
        Map<String, Object> meta = new LinkedHashMap<>();
        TABLES.forEach((table, order) -> meta.put(camel(table), options(table, order)));
        meta.put("subTypes", jdbc.query("""
                SELECT st.code, st.label, st.category_code, stt.template_code
                FROM sub_types st LEFT JOIN sub_type_templates stt ON stt.sub_type_code = st.code
                ORDER BY st.sort_order""",
                (rs, i) -> new SubTypeOption(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4))));
        meta.put("currentSeason", Dates.currentSeason().name());
        meta.put("today", Dates.today().toString());
        return meta;
    }

    List<Option> options(String table, String order) {
        // 테이블 이름과 정렬식은 위의 고정 목록에서만 온다(사용자 입력 아님).
        return jdbc.query("SELECT code, label FROM " + table + " ORDER BY " + order,
                (rs, i) -> new Option(rs.getString(1), rs.getString(2)));
    }

    static String camel(String snake) {
        StringBuilder out = new StringBuilder();
        boolean upper = false;
        for (char c : snake.toCharArray()) {
            if (c == '_') {
                upper = true;
            } else {
                out.append(upper ? Character.toUpperCase(c) : c);
                upper = false;
            }
        }
        return out.toString();
    }
}
