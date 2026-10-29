package ai.otgyeol.space;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GarmentPlacementRepository extends JpaRepository<GarmentPlacement, Long> {

    @Query("select p from GarmentPlacement p where p.garmentId in (select g.id from Garment g where g.userId = :userId)")
    List<GarmentPlacement> findByOwner(@Param("userId") Long userId);

    long countBySpaceId(Long spaceId);
}
