package ai.otgyeol.move;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MoveBatchRepository extends JpaRepository<MoveBatch, Long> {

    List<MoveBatch> findTop20ByUserIdOrderByIdDesc(Long userId);
}
