package ai.otgyeol.garment;

/** 의류 기록에 쓰는 나머지 도메인 값. 각 값은 같은 이름의 도메인 테이블 code와 같다. */
public final class Domains {

    private Domains() {
    }

    /** garment_fields: AI가 읽거나 채울 수 있는 항목. */
    public enum GarmentField {
        NAME("옷 이름"), BRAND("브랜드"), PRODUCT_CODE("품번"), COLOR("색상"), SIZE_LABEL("표기 사이즈"),
        ORIGIN("원산지"), SUB_TYPE("세부 종류"), MATERIAL("소재"), CARE("세탁·관리"), SEASONS("계절");

        public final String label;

        GarmentField(String label) {
            this.label = label;
        }
    }

    /** material_parts */
    public enum MaterialPart {
        SHELL("겉감"), LINING("안감"), TRIM("배색"), FILL("충전재");

        public final String label;

        MaterialPart(String label) {
            this.label = label;
        }
    }

    /** fibers */
    public enum Fiber {
        COTTON("면"), POLYESTER("폴리에스터"), WOOL("울"), ACRYLIC("아크릴"), NYLON("나일론"), RAYON("레이온"),
        POLYURETHANE("폴리우레탄"), LINEN("마"), SILK("실크"), CASHMERE("캐시미어"), VISCOSE("비스코스"),
        MODAL("모달"), LYOCELL("라이오셀"), LEATHER("가죽"), DOWN("다운"), FEATHER("페더"), OTHER("기타 섬유");

        public final String label;

        Fiber(String label) {
            this.label = label;
        }
    }

    /** measurement_parts */
    public enum MeasurementPart {
        TOTAL_LENGTH("총장"), SHOULDER("어깨"), CHEST("가슴"), SLEEVE("소매"), WAIST("허리"), HIP("엉덩이"),
        THIGH("허벅지"), RISE("밑위"), HEM("밑단");

        public final String label;

        MeasurementPart(String label) {
            this.label = label;
        }
    }

    /** measurement_kinds */
    public enum MeasurementKind {
        SECTION("단면"), CIRCUMFERENCE("둘레"), LENGTH("길이");

        public final String label;

        MeasurementKind(String label) {
            this.label = label;
        }
    }
}
