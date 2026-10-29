package ai.otgyeol.space;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 수납 위치. 계층은 storage_space_parents에 둔다. 실측 치수 없이 대략적인 수용 개수만 둔다. */
@Entity
@Table(name = "storage_spaces")
public class StorageSpace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long userId;
    public String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "space_type_code")
    public SpaceType spaceType;

    public Integer capacity;
    public Instant createdAt = Instant.now();
}
