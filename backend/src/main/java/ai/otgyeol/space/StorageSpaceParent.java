package ai.otgyeol.space;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 공간 계층: 안쪽 공간 → 바깥 공간. 최상위 공간은 행이 없다. */
@Entity
@Table(name = "storage_space_parents")
public class StorageSpaceParent {

    @Id
    public Long spaceId;

    public Long parentSpaceId;

    protected StorageSpaceParent() {
    }

    public StorageSpaceParent(Long spaceId, Long parentSpaceId) {
        this.spaceId = spaceId;
        this.parentSpaceId = parentSpaceId;
    }
}
