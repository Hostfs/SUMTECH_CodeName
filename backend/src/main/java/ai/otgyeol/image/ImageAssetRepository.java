package ai.otgyeol.image;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ImageAssetRepository extends JpaRepository<ImageAsset, Long> {

    Optional<ImageAsset> findByIdAndUserId(Long id, Long userId);

    /** 종류 계산에 쓰는 이미지 목록(데이터 본문은 읽지 않는다). */
    @Query("select i.id as id, i.sourceUrl as sourceUrl from ImageAsset i where i.id in :ids")
    List<ImageMeta> findMeta(@Param("ids") Collection<Long> ids);

    interface ImageMeta {
        Long getId();

        String getSourceUrl();
    }
}
