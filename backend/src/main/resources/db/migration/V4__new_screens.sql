
-- =====================================================================
-- V4: 새 화면(모바일 디자인)과 맞춤
-- =====================================================================

-- 새 화면은 신발을 따로 관리하고, 세부 종류로 패딩·플리츠 스커트·스니커즈·로퍼·부츠를 고른다.
INSERT INTO categories (code, label) VALUES ('SHOES', '신발');

INSERT INTO sub_types (code, label, category_code, sort_order) VALUES
    ('PADDING', '패딩', 'OUTER', 16),
    ('PLEATED_SKIRT', '플리츠 스커트', 'BOTTOM', 17),
    ('SNEAKERS', '스니커즈', 'SHOES', 18),
    ('LOAFERS', '로퍼', 'SHOES', 19),
    ('BOOTS', '부츠', 'SHOES', 20);

-- 신발장처럼 올려 두는 공간.
INSERT INTO space_types (code, label) VALUES ('SHELF', '선반');

-- 사용자가 적는 한 줄 메모(예: '한겨울 외출용'). 옷 한 벌에 하나인 값이라 garments에 둔다.
ALTER TABLE garments ADD COLUMN memo VARCHAR(500) NULL AFTER origin;
