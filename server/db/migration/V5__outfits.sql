-- =====================================================================
-- V5: 코디(저장한 착장)
-- =====================================================================

-- 사용자가 이름을 붙여 저장한 코디. 지금 입을 수 있는지(옷이 모두 집 안에 있고 사용 가능)는 저장하지 않고 요청할 때 계산한다.
-- V3에서 지운 3D 코디(outfits·outfit_garments)와 섞이지 않게 새 이름을 쓴다.
CREATE TABLE outfit_looks (
    id         BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT      NOT NULL,
    name       VARCHAR(50) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_outfit_looks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_outfit_looks_name CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_outfit_looks_user ON outfit_looks (user_id, created_at);

-- 코디 ↔ 자리(아우터·상의·하의·원피스)마다 옷 한 벌. 자리와 옷 종류가 맞는지는 서버가 검사한다
-- (옷 종류는 sub_types를 거쳐 정해지므로 여기에 다시 두지 않는다). 옷을 지우면 그 자리만 빠진다.
CREATE TABLE outfit_look_garments (
    look_id    BIGINT      NOT NULL,
    slot_code  VARCHAR(10) NOT NULL,
    garment_id BIGINT      NOT NULL,
    PRIMARY KEY (look_id, slot_code),
    CONSTRAINT fk_olg_look FOREIGN KEY (look_id) REFERENCES outfit_looks (id) ON DELETE CASCADE,
    CONSTRAINT fk_olg_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT ck_olg_slot CHECK (slot_code IN ('OUTER', 'TOP', 'BOTTOM', 'DRESS'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_olg_garment ON outfit_look_garments (garment_id);

-- 코디와 옷의 주인이 같아야 한다(서버 검사를 통과한 경쟁 상황의 최종 방어).
DELIMITER $$
CREATE TRIGGER trg_outfit_look_garments_owner_ins BEFORE INSERT ON outfit_look_garments FOR EACH ROW
BEGIN
    IF NOT ((SELECT user_id FROM outfit_looks WHERE id = NEW.look_id) <=> (SELECT user_id FROM garments WHERE id = NEW.garment_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:outfit_look_garments';
    END IF;
END$$
CREATE TRIGGER trg_outfit_look_garments_owner_upd BEFORE UPDATE ON outfit_look_garments FOR EACH ROW
BEGIN
    IF NOT ((SELECT user_id FROM outfit_looks WHERE id = NEW.look_id) <=> (SELECT user_id FROM garments WHERE id = NEW.garment_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:outfit_look_garments';
    END IF;
END$$
DELIMITER ;
