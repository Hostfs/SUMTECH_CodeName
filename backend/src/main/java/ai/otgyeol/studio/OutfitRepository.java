package ai.otgyeol.studio;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OutfitRepository extends JpaRepository<Outfit, Long> {

    List<Outfit> findByUserIdOrderByIdDesc(Long userId);

    Optional<Outfit> findByIdAndUserId(Long id, Long userId);
}
