package ai.otgyeol.label;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductSearchRepository extends JpaRepository<ProductSearch, Long> {

    Optional<ProductSearch> findByIdAndUserId(Long id, Long userId);

    @Query("select s from ProductSearch s where s.id = (select max(l.searchId) from LabelExtractionSearch l where l.extractionId = :extractionId)")
    Optional<ProductSearch> findLatestForExtraction(@Param("extractionId") Long extractionId);
}
