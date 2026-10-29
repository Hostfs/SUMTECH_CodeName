package ai.otgyeol.label;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LabelExtractionRepository extends JpaRepository<LabelExtraction, Long> {

    Optional<LabelExtraction> findByIdAndUserId(Long id, Long userId);

    @Query("select e from LabelExtraction e where e.id = (select max(l.extractionId) from GarmentLabelExtraction l where l.garmentId = :garmentId)")
    Optional<LabelExtraction> findLatestForGarment(@Param("garmentId") Long garmentId);

    /** 택 사진으로 쓰인 이미지 ID(이미지 종류 계산용). */
    @Query(value = "select distinct image_id from label_extraction_images where image_id in (:ids)", nativeQuery = true)
    List<Long> findLabelImageIds(@Param("ids") Collection<Long> ids);
}
