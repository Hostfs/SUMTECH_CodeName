package ai.otgyeol.garment;

public enum Season {
    SPRING("봄"), SUMMER("여름"), AUTUMN("가을"), WINTER("겨울");

    public final String label;

    Season(String label) {
        this.label = label;
    }
}
