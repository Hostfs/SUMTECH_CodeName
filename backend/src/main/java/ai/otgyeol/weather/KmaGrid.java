package ai.otgyeol.weather;

/**
 * 위도·경도를 기상청 동네예보 격자(nx, ny)로 바꾼다. 기상청 단기예보 조회서비스 활용가이드의 Lambert 정각원추도법 변환식을 따른다.
 */
public final class KmaGrid {

    private static final double RE = 6371.00877; // 지구 반경(km)
    private static final double GRID = 5.0; // 격자 간격(km)
    private static final double SLAT1 = Math.toRadians(30.0);
    private static final double SLAT2 = Math.toRadians(60.0);
    private static final double OLON = Math.toRadians(126.0);
    private static final double OLAT = Math.toRadians(38.0);
    private static final double XO = 43;
    private static final double YO = 136;

    private KmaGrid() {
    }

    public record Point(int nx, int ny) {
    }

    public static Point of(double lat, double lon) {
        double re = RE / GRID;
        double sn = Math.log(Math.cos(SLAT1) / Math.cos(SLAT2))
                / Math.log(Math.tan(Math.PI * 0.25 + SLAT2 * 0.5) / Math.tan(Math.PI * 0.25 + SLAT1 * 0.5));
        double sf = Math.pow(Math.tan(Math.PI * 0.25 + SLAT1 * 0.5), sn) * Math.cos(SLAT1) / sn;
        double ro = re * sf / Math.pow(Math.tan(Math.PI * 0.25 + OLAT * 0.5), sn);
        double ra = re * sf / Math.pow(Math.tan(Math.PI * 0.25 + Math.toRadians(lat) * 0.5), sn);
        double theta = Math.toRadians(lon) - OLON;
        if (theta > Math.PI) {
            theta -= 2.0 * Math.PI;
        }
        if (theta < -Math.PI) {
            theta += 2.0 * Math.PI;
        }
        theta *= sn;
        int nx = (int) Math.floor(ra * Math.sin(theta) + XO + 0.5);
        int ny = (int) Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
        return new Point(nx, ny);
    }
}
