package ai.otgyeol.move;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

/** 박스·집 밖 공간으로 보낸 묶음의 목적지와 옮긴 날, 들어간 옷. 옷의 현재 위치는 garment_placements가 가진다. */
@Entity
@Table(name = "move_batch_spaces")
public class MoveBatchSpace {

    @Id
    public Long batchId;

    public Long spaceId;
    public LocalDate movedOn;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "move_batch_space_garments", joinColumns = @JoinColumn(name = "batch_id"))
    @Column(name = "garment_id")
    public Set<Long> garmentIds = new LinkedHashSet<>();
}
