package ai.otgyeol.image;

/** 이미지 종류. 저장하지 않고 이 순서로 계산한다(docs/db/ERD.md 5절). */
public enum ImageKind {
    /** label_extraction_images에 있는 이미지 */
    LABEL,
    /** image_processings의 결과 이미지 */
    PROCESSED,
    /** source_url이 있는 이미지 */
    PRODUCT_ORIGINAL,
    /** 그 밖의 직접 찍은 옷 사진 */
    GARMENT_ORIGINAL
}
