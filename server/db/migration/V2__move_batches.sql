
-- =====================================================================
-- V2: 옮기는 단위(박스·본가·세탁소) 묶음 기록 (F10)
-- =====================================================================

-- 박스(집 안에서 통째로 옮기는 상자)와 집 밖(본가 등) 공간 유형.
INSERT INTO space_types (code, label) VALUES
    ('BOX', '박스'), ('OFFSITE', '집 밖');

-- 옮긴 묶음 하나. 목적지는 아래 두 테이블 중 하나에만 행이 있다(서버가 강제, ERD 6절).
-- 날짜는 목적지 쪽의 사실이다: 공간으로 옮긴 날은 move_batch_spaces.moved_on, 세탁소에 맡긴 날은 care_events.dropped_on.
CREATE TABLE move_batches (
    id         BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT      NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_mb_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 박스·집 밖 공간으로 보낸 묶음. 옷의 현재 위치는 garment_placements가 가지고, 이 표는 옮긴 기록이다.
CREATE TABLE move_batch_spaces (
    batch_id BIGINT NOT NULL PRIMARY KEY,
    space_id BIGINT NOT NULL,
    moved_on DATE   NOT NULL,
    CONSTRAINT fk_mbs_batch FOREIGN KEY (batch_id) REFERENCES move_batches (id) ON DELETE CASCADE,
    CONSTRAINT fk_mbs_space FOREIGN KEY (space_id) REFERENCES storage_spaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 공간으로 보낸 묶음에 든 옷.
CREATE TABLE move_batch_space_garments (
    batch_id   BIGINT NOT NULL,
    garment_id BIGINT NOT NULL,
    PRIMARY KEY (batch_id, garment_id),
    CONSTRAINT fk_mbsg_batch FOREIGN KEY (batch_id) REFERENCES move_batch_spaces (batch_id) ON DELETE CASCADE,
    CONSTRAINT fk_mbsg_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 세탁소로 보낸 묶음: 옷마다 만든 세탁 기록. 옷·업체·날짜는 care_events에 있으므로 다시 저장하지 않는다.
CREATE TABLE move_batch_care_events (
    care_event_id BIGINT NOT NULL PRIMARY KEY,
    batch_id      BIGINT NOT NULL,
    CONSTRAINT fk_mbce_care FOREIGN KEY (care_event_id) REFERENCES care_events (id) ON DELETE CASCADE,
    CONSTRAINT fk_mbce_batch FOREIGN KEY (batch_id) REFERENCES move_batches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 묶음에 남긴 원본 사진(박스 라벨 QR, 세탁소 영수증). 이미지는 많아야 한 묶음에 속한다.
CREATE TABLE move_batch_images (
    image_id BIGINT NOT NULL PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    CONSTRAINT fk_mbi_image FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
    CONSTRAINT fk_mbi_batch FOREIGN KEY (batch_id) REFERENCES move_batches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 같은 주인 규칙: 묶음과 연결되는 공간·옷·세탁 기록·이미지는 묶음 주인의 것이어야 한다.
DELIMITER $$
CREATE TRIGGER trg_move_batch_spaces_owner_ins BEFORE INSERT ON move_batch_spaces FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id) IS NOT NULL AND NOT ((SELECT user_id FROM move_batches WHERE id = NEW.batch_id) <=> (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:move_batch_spaces';
    END IF;
END$$
CREATE TRIGGER trg_move_batch_spaces_owner_upd BEFORE UPDATE ON move_batch_spaces FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id) IS NOT NULL AND NOT ((SELECT user_id FROM move_batches WHERE id = NEW.batch_id) <=> (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:move_batch_spaces';
    END IF;
END$$
CREATE TRIGGER trg_move_batch_space_garments_owner_ins BEFORE INSERT ON move_batch_space_garments FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM garments WHERE id = NEW.garment_id) IS NOT NULL AND NOT ((SELECT user_id FROM move_batches WHERE id = NEW.batch_id) <=> (SELECT user_id FROM garments WHERE id = NEW.garment_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:move_batch_space_garments';
    END IF;
END$$
CREATE TRIGGER trg_move_batch_space_garments_owner_upd BEFORE UPDATE ON move_batch_space_garments FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM garments WHERE id = NEW.garment_id) IS NOT NULL AND NOT ((SELECT user_id FROM move_batches WHERE id = NEW.batch_id) <=> (SELECT user_id FROM garments WHERE id = NEW.garment_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:move_batch_space_garments';
    END IF;
END$$
CREATE TRIGGER trg_move_batch_care_events_owner_ins BEFORE INSERT ON move_batch_care_events FOR EACH ROW
BEGIN
    IF (SELECT g.user_id FROM care_events c JOIN garments g ON g.id = c.garment_id WHERE c.id = NEW.care_event_id) IS NOT NULL AND NOT ((SELECT user_id FROM move_batches WHERE id = NEW.batch_id) <=> (SELECT g.user_id FROM care_events c JOIN garments g ON g.id = c.garment_id WHERE c.id = NEW.care_event_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:move_batch_care_events';
    END IF;
END$$
CREATE TRIGGER trg_move_batch_care_events_owner_upd BEFORE UPDATE ON move_batch_care_events FOR EACH ROW
BEGIN
    IF (SELECT g.user_id FROM care_events c JOIN garments g ON g.id = c.garment_id WHERE c.id = NEW.care_event_id) IS NOT NULL AND NOT ((SELECT user_id FROM move_batches WHERE id = NEW.batch_id) <=> (SELECT g.user_id FROM care_events c JOIN garments g ON g.id = c.garment_id WHERE c.id = NEW.care_event_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:move_batch_care_events';
    END IF;
END$$
CREATE TRIGGER trg_move_batch_images_owner_ins BEFORE INSERT ON move_batch_images FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM images WHERE id = NEW.image_id) IS NOT NULL AND NOT ((SELECT user_id FROM move_batches WHERE id = NEW.batch_id) <=> (SELECT user_id FROM images WHERE id = NEW.image_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:move_batch_images';
    END IF;
END$$
CREATE TRIGGER trg_move_batch_images_owner_upd BEFORE UPDATE ON move_batch_images FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM images WHERE id = NEW.image_id) IS NOT NULL AND NOT ((SELECT user_id FROM move_batches WHERE id = NEW.batch_id) <=> (SELECT user_id FROM images WHERE id = NEW.image_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:move_batch_images';
    END IF;
END$$
DELIMITER ;
