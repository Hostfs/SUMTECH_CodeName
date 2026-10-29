
-- =====================================================================
-- V3: 범위 정리(수정안 2026-10-29)와 제품 검색 연결 보완
-- =====================================================================

-- 3D 코디·코디 추천(R05·R06)을 범위에서 뺐다. 읽거나 쓰는 코드가 없는 테이블을 지운다(트리거는 테이블과 함께 지워진다).
DROP TABLE outfit_garments;
DROP TABLE outfits;
DROP TABLE body_profiles;

-- 옷 ↔ 그 옷을 등록할 때 한 제품 검색(F3). 택 분석 없이 이름만으로 검색해도 '검색 결과 없음'이 옷 상세에 남게 한다.
-- 택 분석을 거친 검색은 label_extraction_searches로도 이어진다. 한 벌에 검색 하나(가장 최근에 저장한 것).
CREATE TABLE garment_product_searches (
    garment_id BIGINT NOT NULL PRIMARY KEY,
    search_id  BIGINT NOT NULL,
    CONSTRAINT fk_gps_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_gps_search FOREIGN KEY (search_id) REFERENCES product_searches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
CREATE TRIGGER trg_garment_product_searches_owner_ins BEFORE INSERT ON garment_product_searches FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM product_searches WHERE id = NEW.search_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM product_searches WHERE id = NEW.search_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_product_searches';
    END IF;
END$$
CREATE TRIGGER trg_garment_product_searches_owner_upd BEFORE UPDATE ON garment_product_searches FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM product_searches WHERE id = NEW.search_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM product_searches WHERE id = NEW.search_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_product_searches';
    END IF;
END$$
DELIMITER ;
