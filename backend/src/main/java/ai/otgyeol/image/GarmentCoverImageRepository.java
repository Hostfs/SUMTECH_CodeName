package ai.otgyeol.image;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GarmentCoverImageRepository extends JpaRepository<GarmentCoverImage, Long> {

    @Query("select c from GarmentCoverImage c where c.garmentId in (select g.id from Garment g where g.userId = :userId)")
    List<GarmentCoverImage> findByOwner(@Param("userId") Long userId);
}
