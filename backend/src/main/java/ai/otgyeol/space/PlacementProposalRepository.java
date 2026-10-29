package ai.otgyeol.space;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlacementProposalRepository extends JpaRepository<PlacementProposal, Long> {

    @Query("select p from PlacementProposal p where p.garmentId in (select g.id from Garment g where g.userId = :userId) order by p.id")
    List<PlacementProposal> findByOwner(@Param("userId") Long userId);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("delete from PlacementProposal p where p.garmentId in :garmentIds")
    void deleteByGarmentIds(@Param("garmentIds") Collection<Long> garmentIds);
}
