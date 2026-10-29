package ai.otgyeol.space;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

/** 공간 계층(storage_space_parents)을 따라 '옷장 A → 왼쪽 행거' 형태의 경로를 만든다. */
@Component
public class LocationPaths {

    public static final String SEPARATOR = " → ";

    private final StorageSpaceRepository spaces;
    private final StorageSpaceParentRepository parents;

    public LocationPaths(StorageSpaceRepository spaces, StorageSpaceParentRepository parents) {
        this.spaces = spaces;
        this.parents = parents;
    }

    /** 한 사용자의 공간 ID → 경로. */
    public Map<Long, String> forUser(long userId) {
        Map<Long, String> names = new HashMap<>();
        spaces.findByUserIdOrderByIdAsc(userId).forEach(s -> names.put(s.id, s.name));
        Map<Long, Long> parentOf = parentMap(userId);
        Map<Long, String> paths = new HashMap<>();
        for (Long id : names.keySet()) {
            paths.put(id, path(id, names, parentOf));
        }
        return paths;
    }

    public Map<Long, Long> parentMap(long userId) {
        Map<Long, Long> parentOf = new HashMap<>();
        parents.findByOwner(userId).forEach(p -> parentOf.put(p.spaceId, p.parentSpaceId));
        return parentOf;
    }

    static String path(Long id, Map<Long, String> names, Map<Long, Long> parentOf) {
        List<String> parts = new ArrayList<>();
        Long current = id;
        // 순환이 있더라도 멈추도록 깊이를 제한한다(서버는 순환을 만들지 않는다).
        for (int depth = 0; current != null && depth < 10; depth++) {
            parts.add(names.get(current));
            current = parentOf.get(current);
        }
        Collections.reverse(parts);
        return String.join(SEPARATOR, parts);
    }
}
