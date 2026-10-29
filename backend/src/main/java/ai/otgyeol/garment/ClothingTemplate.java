package ai.otgyeol.garment;

/** 3D 코디가 지원하는 의류 템플릿 4종(clothing_templates 도메인 테이블과 같은 값). */
public enum ClothingTemplate {
    SHORT_SLEEVE_TOP("반소매 상의", Category.TOP),
    LONG_SLEEVE_TOP("긴소매 상의", Category.TOP),
    JACKET("재킷", Category.OUTER),
    LONG_PANTS("긴바지", Category.BOTTOM);

    public final String label;
    public final Category category;

    ClothingTemplate(String label, Category category) {
        this.label = label;
        this.category = category;
    }
}
