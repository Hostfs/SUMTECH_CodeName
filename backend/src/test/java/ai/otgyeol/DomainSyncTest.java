package ai.otgyeol;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import ai.otgyeol.care.CareEvent;
import ai.otgyeol.garment.Category;
import ai.otgyeol.garment.ClothingTemplate;
import ai.otgyeol.garment.Domains;
import ai.otgyeol.garment.GarmentStatus;
import ai.otgyeol.garment.Season;
import ai.otgyeol.garment.SubType;
import ai.otgyeol.garment.WearFrequency;
import ai.otgyeol.space.SpaceType;

/** 코드의 열거형과 DB 도메인 테이블(schema.sql)의 코드·이름·관계가 같은지 교차 확인한다. */
@SpringBootTest
@Import(CleanDatabaseConfig.class)
class DomainSyncTest {

    @Autowired
    JdbcTemplate jdbc;

    Map<String, String> table(String name) {
        Map<String, String> out = new LinkedHashMap<>();
        jdbc.query("SELECT code, label FROM " + name, rs -> {
            out.put(rs.getString(1), rs.getString(2));
        });
        return out;
    }

    static <E extends Enum<E>> Map<String, String> labels(Class<E> type, Function<E, String> label) {
        return Arrays.stream(type.getEnumConstants()).collect(Collectors.toMap(Enum::name, label));
    }

    @Test
    void enumsMatchDomainTables() {
        assertThat(table("categories")).isEqualTo(labels(Category.class, c -> c.label));
        assertThat(table("clothing_templates")).isEqualTo(labels(ClothingTemplate.class, t -> t.label));
        assertThat(table("sub_types")).isEqualTo(labels(SubType.class, s -> s.label));
        assertThat(table("seasons")).isEqualTo(labels(Season.class, s -> s.label));
        assertThat(table("garment_statuses")).isEqualTo(labels(GarmentStatus.class, s -> s.label));
        assertThat(table("wear_frequencies")).isEqualTo(labels(WearFrequency.class, w -> w.label));
        assertThat(table("space_types")).isEqualTo(labels(SpaceType.class, t -> t.label));
        assertThat(table("care_types")).isEqualTo(labels(CareEvent.CareType.class, t -> t.label));
        assertThat(table("care_places")).isEqualTo(labels(CareEvent.Place.class, p -> p.label));
        assertThat(table("garment_fields")).isEqualTo(labels(Domains.GarmentField.class, f -> f.label));
        assertThat(table("material_parts")).isEqualTo(labels(Domains.MaterialPart.class, p -> p.label));
        assertThat(table("fibers")).isEqualTo(labels(Domains.Fiber.class, f -> f.label));
        assertThat(table("measurement_parts")).isEqualTo(labels(Domains.MeasurementPart.class, p -> p.label));
        assertThat(table("measurement_kinds")).isEqualTo(labels(Domains.MeasurementKind.class, k -> k.label));
    }

    @Test
    void relationsMatchDomainTables() {
        Map<String, String> subTypeCategory = new LinkedHashMap<>();
        jdbc.query("SELECT code, category_code FROM sub_types", rs -> {
            subTypeCategory.put(rs.getString(1), rs.getString(2));
        });
        assertThat(subTypeCategory).isEqualTo(labels(SubType.class, s -> s.category.name()));

        Map<String, String> subTypeTemplate = new LinkedHashMap<>();
        jdbc.query("SELECT sub_type_code, template_code FROM sub_type_templates", rs -> {
            subTypeTemplate.put(rs.getString(1), rs.getString(2));
        });
        Map<String, String> expected = Arrays.stream(SubType.values()).filter(s -> s.template != null)
                .collect(Collectors.toMap(Enum::name, s -> s.template.name()));
        assertThat(subTypeTemplate).isEqualTo(expected);

        Map<String, String> templateCategory = new LinkedHashMap<>();
        jdbc.query("SELECT code, category_code FROM clothing_templates", rs -> {
            templateCategory.put(rs.getString(1), rs.getString(2));
        });
        assertThat(templateCategory).isEqualTo(labels(ClothingTemplate.class, t -> t.category.name()));

        Map<String, String> careStatus = new LinkedHashMap<>();
        jdbc.query("SELECT code, garment_status_code FROM care_types", rs -> {
            careStatus.put(rs.getString(1), rs.getString(2));
        });
        assertThat(careStatus).isEqualTo(labels(CareEvent.CareType.class, t -> t.garmentStatus.name()));
        // 집에 없는 상태 = care_types에 나오는 상태
        assertThat(Arrays.stream(GarmentStatus.values()).filter(GarmentStatus::isAway).map(Enum::name))
                .containsExactlyInAnyOrderElementsOf(careStatus.values());
    }
}
