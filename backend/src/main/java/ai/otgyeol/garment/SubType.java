package ai.otgyeol.garment;

/**
 * 세부 종류(sub_types 도메인 테이블과 같은 값). 종류(category)와 3D 템플릿은 세부 종류에서 정해진다.
 * 템플릿이 없는 종류는 template이 null이며 '3D 미지원'으로 표시한다. DomainSyncTest가 DB 값과 같은지 확인한다.
 */
public enum SubType {
    SHORT_SLEEVE_TEE("반소매 티셔츠", Category.TOP, ClothingTemplate.SHORT_SLEEVE_TOP),
    LONG_SLEEVE_TEE("긴소매 티셔츠", Category.TOP, ClothingTemplate.LONG_SLEEVE_TOP),
    SHIRT("셔츠", Category.TOP, ClothingTemplate.LONG_SLEEVE_TOP),
    KNIT("니트", Category.TOP, ClothingTemplate.LONG_SLEEVE_TOP),
    TOP_ETC("기타 상의", Category.TOP, null),
    JACKET("재킷", Category.OUTER, ClothingTemplate.JACKET),
    COAT("코트", Category.OUTER, null),
    OUTER_ETC("기타 아우터", Category.OUTER, null),
    PANTS("바지", Category.BOTTOM, ClothingTemplate.LONG_PANTS),
    JEANS("청바지", Category.BOTTOM, ClothingTemplate.LONG_PANTS),
    SHORTS("반바지", Category.BOTTOM, null),
    SKIRT("치마", Category.BOTTOM, null),
    BOTTOM_ETC("기타 하의", Category.BOTTOM, null),
    DRESS("원피스", Category.DRESS, null),
    ETC("기타", Category.ETC, null),
    PADDING("패딩", Category.OUTER, null),
    PLEATED_SKIRT("플리츠 스커트", Category.BOTTOM, null),
    SNEAKERS("스니커즈", Category.SHOES, null),
    LOAFERS("로퍼", Category.SHOES, null),
    BOOTS("부츠", Category.SHOES, null);

    public final String label;
    public final Category category;
    public final ClothingTemplate template;

    SubType(String label, Category category, ClothingTemplate template) {
        this.label = label;
        this.category = category;
        this.template = template;
    }
}
