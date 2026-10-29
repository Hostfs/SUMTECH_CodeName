package ai.otgyeol.label;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductCandidateRepository extends JpaRepository<ProductCandidate, Long> {

    List<ProductCandidate> findBySearchIdOrderByIdAsc(Long searchId);

    long countBySearchId(Long searchId);

    @Query("select c from ProductCandidate c where c.id = :id and c.searchId in (select s.id from ProductSearch s where s.userId = :userId)")
    Optional<ProductCandidate> findOwned(@Param("id") Long id, @Param("userId") Long userId);
}
