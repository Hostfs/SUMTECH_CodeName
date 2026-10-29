package ai.otgyeol.common;

import org.springframework.http.HttpStatus;

/** 사용자에게 이유를 그대로 보여 줄 수 있는 오류. */
public class ApiException extends RuntimeException {

    public final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + "을(를) 찾을 수 없어요.");
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }
}
