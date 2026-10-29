package ai.otgyeol.garment;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ClosetCollectionRepository extends JpaRepository<ClosetCollection, Long> {

    List<ClosetCollection> findByUserIdOrderByNameAsc(Long userId);

    Optional<ClosetCollection> findByUserIdAndName(Long userId, String name);
}
