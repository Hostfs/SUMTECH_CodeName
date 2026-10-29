package ai.otgyeol.image;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GarmentImageRepository extends JpaRepository<GarmentImage, Long> {

    List<GarmentImage> findByGarmentIdOrderByImageIdAsc(Long garmentId);
}
