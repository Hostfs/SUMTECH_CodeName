package ai.otgyeol.space;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 미확정 배치 추천안. 옷 한 벌에 하나이며 '배치 완료'를 누르면 위치를 확정하고 지운다. */
@Entity
@Table(name = "placement_proposals")
public class PlacementProposal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long garmentId;
    public Long spaceId;
    public String reason;
    public Instant createdAt = Instant.now();
}
