package ai.otgyeol.studio;

import java.math.BigDecimal;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 신체 치수(cm). 사용자당 하나, 모르는 값은 null이며 3D 모형은 그 부위를 기본 비율로 그린다. */
@Entity
@Table(name = "body_profiles")
public class BodyProfile {

    @Id
    public Long userId;

    public BigDecimal heightCm;
    public BigDecimal shoulderCm;
    public BigDecimal chestCm;
    public BigDecimal waistCm;
    public BigDecimal hipCm;
    public BigDecimal inseamCm;
}
