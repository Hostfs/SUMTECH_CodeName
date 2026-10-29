package ai.otgyeol.user;

import java.util.List;
import java.util.Locale;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import ai.otgyeol.common.ApiException;

/** 이메일·비밀번호 회원가입과 로그인. 역할은 '사용자' 하나다. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record SignupRequest(
            @NotBlank(message = "이메일을 입력해 주세요.") @Email(message = "이메일 형식이 올바르지 않아요.") String email,
            @NotBlank(message = "비밀번호를 입력해 주세요.") @Size(min = 8, max = 100, message = "비밀번호는 8자 이상이어야 해요.") String password) {
    }

    public record LoginRequest(
            @NotBlank(message = "이메일을 입력해 주세요.") String email,
            @NotBlank(message = "비밀번호를 입력해 주세요.") String password) {
    }

    public record Me(long id, String email) {
    }

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final SecurityContextRepository contextRepository;

    public AuthController(UserRepository users, PasswordEncoder passwordEncoder, SecurityContextRepository contextRepository) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.contextRepository = contextRepository;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    Me signup(@Valid @RequestBody SignupRequest body, HttpServletRequest request, HttpServletResponse response) {
        String email = normalize(body.email());
        if (users.existsByEmail(email)) {
            throw ApiException.conflict("이미 가입된 이메일이에요.");
        }
        User user = new User();
        user.email = email;
        user.passwordHash = passwordEncoder.encode(body.password());
        users.save(user);
        startSession(user, request, response);
        return new Me(user.id, user.email);
    }

    @PostMapping("/login")
    Me login(@Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        User user = users.findByEmail(normalize(body.email()))
                .filter(u -> passwordEncoder.matches(body.password(), u.passwordHash))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 맞지 않아요."));
        startSession(user, request, response);
        return new Me(user.id, user.email);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }

    /** 로그인하지 않았으면 401. 화면은 이 응답으로 로그인 여부를 판단한다. */
    @GetMapping("/me")
    Me me() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        User user = users.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
        return new Me(user.id, user.email);
    }

    private void startSession(User user, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        var token = new UsernamePasswordAuthenticationToken(user.id, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(token);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
