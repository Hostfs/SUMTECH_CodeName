package ai.otgyeol.garment;

public enum Category {
    TOP("상의"), BOTTOM("하의"), OUTER("아우터"), DRESS("원피스"), ETC("기타");

    public final String label;

    Category(String label) {
        this.label = label;
    }
}
