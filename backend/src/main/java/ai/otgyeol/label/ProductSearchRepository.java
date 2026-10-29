package ai.otgyeol.label;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductSearchRepository extends JpaRepository<ProductSearch, Long> {

    Optional<ProductSearch> findByIdAndUserId(Long id, Long userId);

    @Query("select s from ProductSearch s where s.id = (select max(l.searchId) from LabelExtractionSearch l where l.extractionId = :extractionId)")
    Optional<ProductSearch> findLatestForExtraction(@Param("extractionId") Long extractionId);

    /** 옷을 등록할 때 한 검색(택 분석 없이 한 검색 포함). */
    @Query(value = "SELECT s.* FROM product_searches s JOIN garment_product_searches g ON g.search_id = s.id WHERE g.garment_id = :garmentId",
            nativeQuery = true)
    Optional<ProductSearch> findForGarment(@Param("garmentId") Long garmentId);

    @Modifying
    @Query(value = "INSERT INTO garment_product_searches (garment_id, search_id) VALUES (:garmentId, :searchId) "
            + "ON DUPLICATE KEY UPDATE search_id = VALUES(search_id)", nativeQuery = true)
    void linkToGarment(@Param("garmentId") Long garmentId, @Param("searchId") Long searchId);
}
