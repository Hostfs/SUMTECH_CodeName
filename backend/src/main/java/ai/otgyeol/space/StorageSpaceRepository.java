package ai.otgyeol.space;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StorageSpaceRepository extends JpaRepository<StorageSpace, Long> {

    List<StorageSpace> findByUserIdOrderByIdAsc(Long userId);

    Optional<StorageSpace> findByIdAndUserId(Long id, Long userId);
}
