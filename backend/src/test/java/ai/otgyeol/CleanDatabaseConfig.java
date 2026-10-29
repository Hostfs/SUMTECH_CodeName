package ai.otgyeol;

import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/** 테스트마다 빈 DB에서 시작하도록 Flyway로 스키마를 지우고 다시 만든다(주최 측 실행의 빈 DB와 같은 조건). */
@TestConfiguration
public class CleanDatabaseConfig {

    @Bean
    FlywayMigrationStrategy cleanThenMigrate() {
        return flyway -> {
            flyway.clean();
            flyway.migrate();
        };
    }
}
