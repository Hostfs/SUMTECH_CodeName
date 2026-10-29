package ai.otgyeol.garment;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GarmentRepository extends JpaRepository<Garment, Long> {

    List<Garment> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<Garment> findByIdAndUserId(Long id, Long userId);
}
