package ai.otgyeol.label;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 웹 검색 1회. '검색 결과 없음'은 SUCCEEDED이면서 후보가 0개인 경우다. searchedAt이 후보의 조회 시점이다. */
@Entity
@Table(name = "product_searches")
public class ProductSearch {

    public enum Status { SUCCEEDED, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long userId;
    public String queryBrand;
    public String queryProductCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_code")
    public Status status;

    public Instant searchedAt = Instant.now();
}
