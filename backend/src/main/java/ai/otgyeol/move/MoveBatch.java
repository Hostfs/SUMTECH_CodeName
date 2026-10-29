package ai.otgyeol.move;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

/**
 * 옮긴 묶음 하나(R11). 목적지는 박스·집 밖 공간(MoveBatchSpace)이거나 세탁소(careEventIds) 중 하나다.
 * 박스 라벨·영수증 원본 사진은 imageIds로 묶음에 남는다.
 */
@Entity
@Table(name = "move_batches")
public class MoveBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long userId;
    public Instant createdAt = Instant.now();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "move_batch_images", joinColumns = @JoinColumn(name = "batch_id"))
    @Column(name = "image_id")
    public Set<Long> imageIds = new LinkedHashSet<>();

    /** 세탁소로 보낸 묶음이면 옷마다 만든 세탁 기록. 옷·업체·날짜는 그 기록에 있다. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "move_batch_care_events", joinColumns = @JoinColumn(name = "batch_id"))
    @Column(name = "care_event_id")
    public Set<Long> careEventIds = new LinkedHashSet<>();
}
