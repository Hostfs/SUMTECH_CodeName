package ai.otgyeol.space;

public enum SpaceType {
    HANG("걸기"), FOLD("접기"), LONG_TERM("장기보관");

    public final String label;

    SpaceType(String label) {
        this.label = label;
    }
}
