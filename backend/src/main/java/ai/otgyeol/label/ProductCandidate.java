package ai.otgyeol.label;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 검색으로 찾은 제품 후보. 검색 당시 웹페이지의 기록이며 확정 전에는 의류 정보에 섞이지 않는다. */
@Entity
@Table(name = "product_candidates")
public class ProductCandidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long searchId;
    public String name;
    public String brand;
    public String productCode;
    public String colorName;
    public String imageUrl;
    public String sourceUrl;
    public String matchReason;
}
