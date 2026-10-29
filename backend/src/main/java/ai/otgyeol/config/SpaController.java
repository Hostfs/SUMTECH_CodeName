package ai.otgyeol.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * React 화면 주소를 index.html로 넘긴다. 여기 없는 주소는 Spring이 404로 응답하므로
 * 없는 주소가 200 빈 화면이 되지 않는다. 화면 주소를 추가하면 이 목록에도 추가한다.
 */
@Controller
public class SpaController {

    @GetMapping({ "/login", "/signup", "/closet", "/closet/{id:\\d+}", "/register", "/map", "/care", "/move", "/outfit", "/storage" })
    String forward() {
        return "forward:/index.html";
    }
}
