package ai.otgyeol.common;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** 세션에 로그인한 사용자의 ID. 모든 개인 자료 조회는 이 값으로 소유자를 거른다. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static long id() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return userId;
    }
}
