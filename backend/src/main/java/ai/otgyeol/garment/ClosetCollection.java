package ai.otgyeol.garment;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 사용자 컬렉션(출근, 여행 등). 옷이 없어도 존재하고 이름을 바꾸면 한 행만 바뀐다. */
@Entity
@Table(name = "collections")
public class ClosetCollection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long userId;
    public String name;
}
