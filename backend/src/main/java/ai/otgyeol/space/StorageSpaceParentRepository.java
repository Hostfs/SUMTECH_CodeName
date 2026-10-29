package ai.otgyeol.space;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StorageSpaceParentRepository extends JpaRepository<StorageSpaceParent, Long> {

    @Query("select p from StorageSpaceParent p where p.spaceId in (select s.id from StorageSpace s where s.userId = :userId)")
    List<StorageSpaceParent> findByOwner(@Param("userId") Long userId);

    boolean existsByParentSpaceId(Long parentSpaceId);
}
