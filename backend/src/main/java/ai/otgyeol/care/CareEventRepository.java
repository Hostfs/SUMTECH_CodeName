package ai.otgyeol.care;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CareEventRepository extends JpaRepository<CareEvent, Long> {

    @Query("select c from CareEvent c where c.garmentId in (select g.id from Garment g where g.userId = :userId) order by c.dueOn, c.id")
    List<CareEvent> findByOwner(@Param("userId") Long userId);

    @Query("select c from CareEvent c where c.id = :id and c.garmentId in (select g.id from Garment g where g.userId = :userId)")
    Optional<CareEvent> findOwned(@Param("id") Long id, @Param("userId") Long userId);

    List<CareEvent> findByGarmentIdOrderByIdDesc(Long garmentId);

    Optional<CareEvent> findFirstByGarmentIdAndCompletedAtIsNull(Long garmentId);
}
