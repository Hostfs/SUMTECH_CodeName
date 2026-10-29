package ai.otgyeol.studio;

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

/** 저장한 코디. 상의·하의 역할은 저장하지 않고 옷의 세부 종류에서 계산한다(BCNF). */
@Entity
@Table(name = "outfits")
public class Outfit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long userId;
    public String name;
    public Instant createdAt = Instant.now();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "outfit_garments", joinColumns = @JoinColumn(name = "outfit_id"))
    @Column(name = "garment_id")
    public Set<Long> garmentIds = new LinkedHashSet<>();
}
