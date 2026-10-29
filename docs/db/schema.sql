-- =====================================================================
-- 옷결 데이터베이스 스키마 (MariaDB 10.4 이상, utf8mb4)
-- 정규화 목표: 1NF → 2NF → 3NF → BCNF → 4NF → 5NF
--   도(1NF)  모든 속성은 원자값이고 정해진 도메인 안의 값이다. 코드 값은 도메인 테이블 FK로 제한한다.
--   무(2NF)  복합 키 테이블의 비키 속성은 키 전체에 종속한다(부분 종속 없음).
--   이(3NF)  비키 속성이 다른 비키 속성을 거쳐 키에 종속하지 않는다(이행 종속 없음).
--            소유자(user_id)는 그 개체 자체의 사실인 곳에만 두고, 다른 개체를 거쳐 정해지는 곳에서는 뺀다.
--   결(BCNF) 모든 결정자는 후보 키다.
--   다(4NF)  서로 독립인 다치 사실(계절, 컬렉션, AI 필드 등)은 각각 별도 테이블에 둔다.
--   조(5NF)  모든 조인 종속은 후보 키가 함의한다. 3개 이상 속성의 전부-키 테이블을 두지 않는다.
-- 상세 분석과 ER 다이어그램: docs/db/ERD.md
-- 데이터베이스는 utf8mb4로 만든다: CREATE DATABASE otgyeol CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 도메인(코드) 테이블: 코드 값의 허용 범위와 한국어 이름
-- ---------------------------------------------------------------------

CREATE TABLE categories (
    code  VARCHAR(20) NOT NULL PRIMARY KEY,
    label VARCHAR(20) NOT NULL,
    CONSTRAINT uk_categories_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3D 템플릿. 템플릿이 어느 종류의 옷인지는 템플릿 자신의 사실이다.
CREATE TABLE clothing_templates (
    code          VARCHAR(20) NOT NULL PRIMARY KEY,
    label         VARCHAR(20) NOT NULL,
    category_code VARCHAR(20) NOT NULL,
    CONSTRAINT uk_templates_label UNIQUE (label),
    CONSTRAINT fk_templates_category FOREIGN KEY (category_code) REFERENCES categories (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 세부 종류. 세부 종류가 종류(category)를 결정하므로 garments에는 세부 종류만 둔다.
CREATE TABLE sub_types (
    code          VARCHAR(20) NOT NULL PRIMARY KEY,
    label         VARCHAR(20) NOT NULL,
    category_code VARCHAR(20) NOT NULL,
    sort_order    INT         NOT NULL,
    CONSTRAINT uk_sub_types_label UNIQUE (label),
    CONSTRAINT uk_sub_types_sort UNIQUE (sort_order),
    CONSTRAINT fk_sub_types_category FOREIGN KEY (category_code) REFERENCES categories (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 세부 종류 → 3D 템플릿. 템플릿이 없는 세부 종류는 행이 없다('3D 미지원').
-- sub_types에 template_code를 두면 template_code → category_code 이행 종속이 생기므로 분리한다.
CREATE TABLE sub_type_templates (
    sub_type_code VARCHAR(20) NOT NULL PRIMARY KEY,
    template_code VARCHAR(20) NOT NULL,
    CONSTRAINT fk_stt_sub_type FOREIGN KEY (sub_type_code) REFERENCES sub_types (code),
    CONSTRAINT fk_stt_template FOREIGN KEY (template_code) REFERENCES clothing_templates (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE seasons (
    code       VARCHAR(10) NOT NULL PRIMARY KEY,
    label      VARCHAR(10) NOT NULL,
    sort_order INT         NOT NULL,
    CONSTRAINT uk_seasons_label UNIQUE (label),
    CONSTRAINT uk_seasons_sort UNIQUE (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 의류 상태(표시용 전체 목록). garments.status_code에는 사용자가 정하는 세 값만 저장하고 나머지는 계산한다.
-- 실물이 집에 없는 상태인지는 care_types.garment_status_code에 나오는지로 판단한다(따로 저장하지 않음).
CREATE TABLE garment_statuses (
    code  VARCHAR(30) NOT NULL PRIMARY KEY,
    label VARCHAR(30) NOT NULL,
    CONSTRAINT uk_garment_statuses_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wear_frequencies (
    code       VARCHAR(10) NOT NULL PRIMARY KEY,
    label      VARCHAR(10) NOT NULL,
    sort_order INT         NOT NULL,
    CONSTRAINT uk_wear_frequencies_label UNIQUE (label),
    CONSTRAINT uk_wear_frequencies_sort UNIQUE (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE space_types (
    code  VARCHAR(20) NOT NULL PRIMARY KEY,
    label VARCHAR(20) NOT NULL,
    CONSTRAINT uk_space_types_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 세탁·수선 종류. 맡기면 의류가 어떤 상태가 되는지는 종류 자신의 사실이다.
CREATE TABLE care_types (
    code                VARCHAR(10) NOT NULL PRIMARY KEY,
    label               VARCHAR(10) NOT NULL,
    garment_status_code VARCHAR(30) NOT NULL,
    CONSTRAINT uk_care_types_label UNIQUE (label),
    CONSTRAINT uk_care_types_status UNIQUE (garment_status_code),
    CONSTRAINT fk_care_types_status FOREIGN KEY (garment_status_code) REFERENCES garment_statuses (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE care_places (
    code  VARCHAR(10) NOT NULL PRIMARY KEY,
    label VARCHAR(10) NOT NULL,
    CONSTRAINT uk_care_places_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 소재 부위(겉감·안감·배색·충전재).
CREATE TABLE material_parts (
    code  VARCHAR(10) NOT NULL PRIMARY KEY,
    label VARCHAR(10) NOT NULL,
    CONSTRAINT uk_material_parts_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 섬유. 택의 표기(코튼, COTTON, 면 등)는 label_extraction_values에 원문으로 남기고, 여기에는 정규화한 섬유만 둔다.
CREATE TABLE fibers (
    code  VARCHAR(20) NOT NULL PRIMARY KEY,
    label VARCHAR(20) NOT NULL,
    CONSTRAINT uk_fibers_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 치수 종류. 단면·둘레·길이를 구분한다.
CREATE TABLE measurement_kinds (
    code  VARCHAR(20) NOT NULL PRIMARY KEY,
    label VARCHAR(10) NOT NULL,
    CONSTRAINT uk_measurement_kinds_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 치수 부위.
CREATE TABLE measurement_parts (
    code  VARCHAR(20) NOT NULL PRIMARY KEY,
    label VARCHAR(20) NOT NULL,
    CONSTRAINT uk_measurement_parts_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI가 읽거나 채울 수 있는 의류 정보 항목.
CREATE TABLE garment_fields (
    code  VARCHAR(30) NOT NULL PRIMARY KEY,
    label VARCHAR(30) NOT NULL,
    CONSTRAINT uk_garment_fields_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE extraction_statuses (
    code  VARCHAR(10) NOT NULL PRIMARY KEY,
    label VARCHAR(10) NOT NULL,
    CONSTRAINT uk_extraction_statuses_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE search_statuses (
    code  VARCHAR(10) NOT NULL PRIMARY KEY,
    label VARCHAR(20) NOT NULL,
    CONSTRAINT uk_search_statuses_label UNIQUE (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. 사용자
-- ---------------------------------------------------------------------

CREATE TABLE users (
    id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME(6)  NOT NULL,
    CONSTRAINT uk_users_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 신체 치수(cm). 사용자당 하나, 모르는 값은 NULL(기본 비율).
CREATE TABLE body_profiles (
    user_id     BIGINT        NOT NULL PRIMARY KEY,
    height_cm   DECIMAL(5, 1) NULL,
    shoulder_cm DECIMAL(5, 1) NULL,
    chest_cm    DECIMAL(5, 1) NULL,
    waist_cm    DECIMAL(5, 1) NULL,
    hip_cm      DECIMAL(5, 1) NULL,
    inseam_cm   DECIMAL(5, 1) NULL,
    CONSTRAINT fk_body_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_body_height CHECK (height_cm IS NULL OR height_cm BETWEEN 100 AND 230),
    CONSTRAINT ck_body_shoulder CHECK (shoulder_cm IS NULL OR shoulder_cm BETWEEN 25 AND 70),
    CONSTRAINT ck_body_chest CHECK (chest_cm IS NULL OR chest_cm BETWEEN 50 AND 180),
    CONSTRAINT ck_body_waist CHECK (waist_cm IS NULL OR waist_cm BETWEEN 40 AND 180),
    CONSTRAINT ck_body_hip CHECK (hip_cm IS NULL OR hip_cm BETWEEN 50 AND 180),
    CONSTRAINT ck_body_inseam CHECK (inseam_cm IS NULL OR inseam_cm BETWEEN 40 AND 110)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. 수납 공간
-- ---------------------------------------------------------------------

CREATE TABLE storage_spaces (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    name            VARCHAR(100) NOT NULL,
    space_type_code VARCHAR(20)  NOT NULL,
    capacity        INT          NULL,
    created_at      DATETIME(6)  NOT NULL,
    CONSTRAINT fk_spaces_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_spaces_type FOREIGN KEY (space_type_code) REFERENCES space_types (code),
    CONSTRAINT ck_spaces_capacity CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 공간 계층(안쪽 공간 → 바깥 공간). 최상위 공간은 행이 없다.
-- storage_spaces에 parent_id를 두면 '같은 주인' 규칙 때문에 parent_id → user_id 종속이 생기고, parent_id는 키가
-- 아니므로 BCNF를 깬다. 그래서 분리하고, 같은 주인 규칙은 아래 트리거가 강제한다.
-- 바깥 공간을 지우면 이 행만 지워져 안쪽 공간이 최상위가 되므로, 서버는 안쪽 공간이 있는 공간의 삭제를 거부한다.
CREATE TABLE storage_space_parents (
    space_id        BIGINT NOT NULL PRIMARY KEY,
    parent_space_id BIGINT NOT NULL,
    CONSTRAINT fk_ssp_space FOREIGN KEY (space_id) REFERENCES storage_spaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_ssp_parent FOREIGN KEY (parent_space_id) REFERENCES storage_spaces (id) ON DELETE CASCADE,
    CONSTRAINT ck_ssp_not_self CHECK (space_id <> parent_space_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. 의류(실물 한 벌)와 그 다치 속성
-- ---------------------------------------------------------------------

-- 사용자 소유의 실물 한 벌. 종류(category)는 sub_type_code로 정해지므로 저장하지 않는다.
-- brand·product_code·color_name은 사용자가 확정한 값이다. 확정한 제품 후보(product_candidates)의 값은
-- 검색 당시 웹페이지의 기록으로 따로 남고, 사용자가 고쳐도 후보 기록은 바꾸지 않는다(서로 다른 사실).
-- 총장 등 치수는 garment_measurements에만 둔다.
-- 위치·대표 이미지·확정 제품은 다른 개체를 가리키는 사실이라 별도 테이블에 둔다(3NF).
-- status_code는 사용자가 정하는 집 안 상태(보관 중·착용·보관 전·세탁 대기)만 저장한다.
-- 화면에 보이는 현재 상태는 다음 순서로 계산하며, 계산 가능한 값은 저장하지 않는다.
--   1) 진행 중인 care_events가 있으면 그 care_types.garment_status_code(세탁 중·수선 중)
--   2) 가장 최근 회수 완료 시각(completed_at)이 확정 위치 시각(placed_at)보다 나중이면(또는 위치가 없으면) '회수 완료·위치 미확인'
--   3) 그 밖에는 status_code
CREATE TABLE garments (
    id                  BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT       NOT NULL,
    name                VARCHAR(100) NOT NULL,
    brand               VARCHAR(100) NULL,
    product_code        VARCHAR(100) NULL,
    color_name          VARCHAR(50)  NULL,
    color_hex           CHAR(7)      NULL,
    size_label          VARCHAR(50)  NULL,
    origin              VARCHAR(100) NULL,
    sub_type_code       VARCHAR(20)  NOT NULL,
    wear_frequency_code VARCHAR(10)  NOT NULL,
    status_code         VARCHAR(30)  NOT NULL,
    usable_when_pending BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          DATETIME(6)  NOT NULL,
    updated_at          DATETIME(6)  NOT NULL,
    CONSTRAINT fk_garments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_garments_sub_type FOREIGN KEY (sub_type_code) REFERENCES sub_types (code),
    CONSTRAINT fk_garments_frequency FOREIGN KEY (wear_frequency_code) REFERENCES wear_frequencies (code),
    CONSTRAINT fk_garments_status FOREIGN KEY (status_code) REFERENCES garment_statuses (code),
    CONSTRAINT ck_garments_status CHECK (status_code IN ('STORED', 'PENDING', 'WASH_WAITING')),
    CONSTRAINT ck_garments_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
    CONSTRAINT ck_garments_color_hex CHECK (color_hex IS NULL OR color_hex REGEXP '^#[0-9A-Fa-f]{6}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4NF: 계절·컬렉션·AI 필드는 서로 독립인 다치 사실이므로 각각 분리한다.
CREATE TABLE garment_seasons (
    garment_id  BIGINT      NOT NULL,
    season_code VARCHAR(10) NOT NULL,
    PRIMARY KEY (garment_id, season_code),
    CONSTRAINT fk_gs_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_gs_season FOREIGN KEY (season_code) REFERENCES seasons (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 사용자 컬렉션(출근, 여행 등). 옷이 없어도 존재하고, 이름을 바꾸면 한 행만 바뀐다.
CREATE TABLE collections (
    id      BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT      NOT NULL,
    name    VARCHAR(50) NOT NULL,
    CONSTRAINT uk_collections_user_name UNIQUE (user_id, name),
    CONSTRAINT fk_collections_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_collections_name CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE garment_collections (
    garment_id    BIGINT NOT NULL,
    collection_id BIGINT NOT NULL,
    PRIMARY KEY (garment_id, collection_id),
    CONSTRAINT fk_gc_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_gc_collection FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI가 채웠고 사용자가 아직 고치지 않은 항목. 사용자가 고치면 행을 지운다.
CREATE TABLE garment_ai_fields (
    garment_id BIGINT      NOT NULL,
    field_code VARCHAR(30) NOT NULL,
    PRIMARY KEY (garment_id, field_code),
    CONSTRAINT fk_gaf_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_gaf_field FOREIGN KEY (field_code) REFERENCES garment_fields (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1NF: '겉감 울 70%, 폴리에스터 30%'를 부위·섬유·혼용률 행으로 나눈다.
-- 부위별 혼용률 합계 100%는 여러 행에 걸친 규칙이라 서버가 저장 전에 확인한다.
CREATE TABLE garment_materials (
    garment_id    BIGINT        NOT NULL,
    part_code     VARCHAR(10)   NOT NULL,
    fiber_code    VARCHAR(20)   NOT NULL,
    percent       DECIMAL(4, 1) NOT NULL,
    PRIMARY KEY (garment_id, part_code, fiber_code),
    CONSTRAINT fk_gm_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_gm_part FOREIGN KEY (part_code) REFERENCES material_parts (code),
    CONSTRAINT fk_gm_fiber FOREIGN KEY (fiber_code) REFERENCES fibers (code),
    CONSTRAINT ck_gm_percent CHECK (percent > 0 AND percent <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1NF: 세탁·관리 지시를 한 줄씩 순서와 함께 나눈다.
CREATE TABLE garment_care_instructions (
    garment_id  BIGINT       NOT NULL,
    line_no     INT          NOT NULL,
    instruction VARCHAR(200) NOT NULL,
    PRIMARY KEY (garment_id, line_no),
    CONSTRAINT fk_gci_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT ck_gci_line CHECK (line_no >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 옷의 치수. 같은 부위라도 단면과 둘레는 다른 행이다. 3D 코디의 옷 길이는 (TOTAL_LENGTH, LENGTH) 행을 쓴다.
CREATE TABLE garment_measurements (
    garment_id BIGINT        NOT NULL,
    part_code  VARCHAR(20)   NOT NULL,
    kind_code  VARCHAR(20)   NOT NULL,
    value_cm   DECIMAL(5, 1) NOT NULL,
    source     VARCHAR(300)  NULL,
    confirmed  BOOLEAN       NOT NULL DEFAULT FALSE,
    PRIMARY KEY (garment_id, part_code, kind_code),
    CONSTRAINT fk_gmeas_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_gmeas_part FOREIGN KEY (part_code) REFERENCES measurement_parts (code),
    CONSTRAINT fk_gmeas_kind FOREIGN KEY (kind_code) REFERENCES measurement_kinds (code),
    CONSTRAINT ck_gmeas_value CHECK (value_cm > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. 위치: 확정 위치와 배치 추천
-- ---------------------------------------------------------------------

-- 확정된 보관 위치. 배치 추천만으로는 바뀌지 않는다. 미배치 옷은 행이 없다
-- ('보관 중'이면서 행이 없으면 집에 있지만 위치를 아직 정하지 않은 미배치 옷이다).
-- 공간 삭제는 서버가 '옷이 있으면 거부'로 막고, CASCADE는 회원 탈퇴 때 삭제 순서와 무관하게 지우기 위한 것이다.
CREATE TABLE garment_placements (
    garment_id BIGINT      NOT NULL PRIMARY KEY,
    space_id   BIGINT      NOT NULL,
    placed_at  DATETIME(6) NOT NULL,
    CONSTRAINT fk_gp_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_gp_space FOREIGN KEY (space_id) REFERENCES storage_spaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 미확정 배치 추천안. '배치 완료'를 누르면 garment_placements에 위치를 쓰고 추천 행은 지운다
-- (적용 시각을 여기 남기면 garment_placements.placed_at과 같은 사실을 두 번 저장하게 된다).
-- 옷 한 벌에 미확정 추천은 하나다.
CREATE TABLE placement_proposals (
    id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    garment_id BIGINT       NOT NULL,
    space_id   BIGINT       NOT NULL,
    reason     VARCHAR(300) NULL,
    created_at DATETIME(6)  NOT NULL,
    CONSTRAINT uk_pp_garment UNIQUE (garment_id),
    CONSTRAINT fk_pp_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_pp_space FOREIGN KEY (space_id) REFERENCES storage_spaces (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. 세탁·수선
-- ---------------------------------------------------------------------

-- completed_at이 채워지면 진행 중 목록에서 빠지고 이력으로 남는다.
-- 옷 한 벌에 진행 중(completed_at IS NULL)인 기록은 많아야 하나다. ongoing_garment_id는 DB가 계산하는 열로
-- 진행 중일 때만 garment_id 값을 가지므로 UNIQUE 인덱스로 강제된다(사용자가 쓰는 사실이 아님).
-- CASCADE FK 열에서 파생된 인덱스 열이므로 VIRTUAL 대신 PERSISTENT로 둔다.
CREATE TABLE care_events (
    id             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    garment_id     BIGINT       NOT NULL,
    care_type_code VARCHAR(10)  NOT NULL,
    place_code     VARCHAR(10)  NOT NULL,
    shop_name      VARCHAR(100) NULL,
    description    VARCHAR(500) NULL,
    dropped_on     DATE         NOT NULL,
    due_on         DATE         NULL,
    completed_at   DATETIME(6)  NULL,
    created_at     DATETIME(6)  NOT NULL,
    ongoing_garment_id BIGINT GENERATED ALWAYS AS (CASE WHEN completed_at IS NULL THEN garment_id END) PERSISTENT,
    CONSTRAINT uk_ce_one_ongoing UNIQUE (ongoing_garment_id),
    CONSTRAINT fk_ce_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_ce_type FOREIGN KEY (care_type_code) REFERENCES care_types (code),
    CONSTRAINT fk_ce_place FOREIGN KEY (place_code) REFERENCES care_places (code),
    CONSTRAINT ck_ce_due CHECK (due_on IS NULL OR due_on >= dropped_on),
    CONSTRAINT ck_ce_completed CHECK (completed_at IS NULL OR DATE(completed_at) >= dropped_on),
    CONSTRAINT ck_ce_shop CHECK (place_code = 'SHOP' OR shop_name IS NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. 이미지
-- ---------------------------------------------------------------------

-- 업로드하거나 가져온 이미지 원본·정리본. 소유자는 이미지 자신의 사실이다(등록 전에는 어느 옷에도 속하지 않음).
-- 이미지 종류는 저장하지 않고 계산한다: label_extraction_images에 있으면 택 사진, image_processings의 결과면
-- 정리된 대표 이미지, source_url이 있으면 제품 이미지 원본, 그 밖에는 직접 찍은 옷 사진.
CREATE TABLE images (
    id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT        NOT NULL,
    content_type VARCHAR(100)  NOT NULL,
    data         LONGBLOB      NOT NULL,
    source_url   VARCHAR(1000) NULL,
    created_at   DATETIME(6)   NOT NULL,
    CONSTRAINT fk_images_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_images_type CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 이미지 → 옷 연결. 이미지는 많아야 한 벌에 속한다.
CREATE TABLE garment_images (
    image_id   BIGINT NOT NULL PRIMARY KEY,
    garment_id BIGINT NOT NULL,
    CONSTRAINT uk_gi_garment_image UNIQUE (garment_id, image_id),
    CONSTRAINT fk_gi_image FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
    CONSTRAINT fk_gi_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 옷의 대표 이미지(목록 카드에 쓰는 한 장). 그 옷에 연결된 이미지만 고를 수 있게
-- (garment_id, image_id)를 garment_images에 복합 FK로 건다.
CREATE TABLE garment_cover_images (
    garment_id BIGINT NOT NULL PRIMARY KEY,
    image_id   BIGINT NOT NULL,
    CONSTRAINT uk_gci_image UNIQUE (image_id),
    CONSTRAINT fk_gcover_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_gcover_own_image FOREIGN KEY (garment_id, image_id) REFERENCES garment_images (garment_id, image_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 배경 제거·정렬 처리. result_image_id가 NULL이면 처리에 실패한 것이고 원본을 그대로 쓴다
-- (성공 여부를 따로 저장하면 result_image_id에서 계산되는 값을 중복 저장하게 된다).
-- 결과 이미지를 지우면 처리 기록도 함께 지워 '처리 전'으로 돌아간다(실패로 바뀌지 않게 CASCADE).
CREATE TABLE image_processings (
    source_image_id BIGINT      NOT NULL PRIMARY KEY,
    result_image_id BIGINT      NULL,
    processed_at    DATETIME(6) NOT NULL,
    CONSTRAINT uk_ip_result UNIQUE (result_image_id),
    CONSTRAINT fk_ip_source FOREIGN KEY (source_image_id) REFERENCES images (id) ON DELETE CASCADE,
    CONSTRAINT fk_ip_result FOREIGN KEY (result_image_id) REFERENCES images (id) ON DELETE CASCADE,
    CONSTRAINT ck_ip_not_self CHECK (result_image_id IS NULL OR result_image_id <> source_image_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. 택 판독
-- ---------------------------------------------------------------------

-- 택 판독 1회. raw_text는 AI가 읽은 원문 전체(하나의 문자열 값)다.
CREATE TABLE label_extractions (
    id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT       NOT NULL,
    raw_text      TEXT         NULL,
    status_code   VARCHAR(10)  NOT NULL,
    error_message VARCHAR(500) NULL,
    created_at    DATETIME(6)  NOT NULL,
    CONSTRAINT fk_le_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_le_status FOREIGN KEY (status_code) REFERENCES extraction_statuses (code),
    CONSTRAINT ck_le_error CHECK ((status_code = 'FAILED') = (error_message IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 판독에 쓴 택 사진(한 번에 여러 장).
CREATE TABLE label_extraction_images (
    extraction_id BIGINT NOT NULL,
    image_id      BIGINT NOT NULL,
    PRIMARY KEY (extraction_id, image_id),
    CONSTRAINT fk_lei_extraction FOREIGN KEY (extraction_id) REFERENCES label_extractions (id) ON DELETE CASCADE,
    CONSTRAINT fk_lei_image FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1NF: 항목별 판독값과 사용자 정정값. read_value가 NULL이면 '확인 필요'(읽지 못함)다.
CREATE TABLE label_extraction_values (
    extraction_id   BIGINT       NOT NULL,
    field_code      VARCHAR(30)  NOT NULL,
    read_value      VARCHAR(500) NULL,
    corrected_value VARCHAR(500) NULL,
    PRIMARY KEY (extraction_id, field_code),
    CONSTRAINT fk_lev_extraction FOREIGN KEY (extraction_id) REFERENCES label_extractions (id) ON DELETE CASCADE,
    CONSTRAINT fk_lev_field FOREIGN KEY (field_code) REFERENCES garment_fields (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 판독 → 그 판독으로 등록된 옷.
CREATE TABLE garment_label_extractions (
    extraction_id BIGINT NOT NULL PRIMARY KEY,
    garment_id    BIGINT NOT NULL,
    CONSTRAINT fk_gle_extraction FOREIGN KEY (extraction_id) REFERENCES label_extractions (id) ON DELETE CASCADE,
    CONSTRAINT fk_gle_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. 제품 검색과 확정
-- ---------------------------------------------------------------------

-- 웹 검색 1회. searched_at이 후보의 조회 시점이다.
-- '검색 결과 없음'은 SUCCEEDED이면서 후보 행이 0개인 경우로 계산한다(후보 유무를 따로 저장하지 않음).
CREATE TABLE product_searches (
    id                 BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id            BIGINT       NOT NULL,
    query_brand        VARCHAR(100) NULL,
    query_product_code VARCHAR(100) NULL,
    status_code        VARCHAR(10)  NOT NULL,
    searched_at        DATETIME(6)  NOT NULL,
    CONSTRAINT fk_ps_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_ps_status FOREIGN KEY (status_code) REFERENCES search_statuses (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 검색 → 그 검색의 근거가 된 택 판독(직접 입력으로 검색했으면 행이 없다).
CREATE TABLE label_extraction_searches (
    search_id     BIGINT NOT NULL PRIMARY KEY,
    extraction_id BIGINT NOT NULL,
    CONSTRAINT fk_les_search FOREIGN KEY (search_id) REFERENCES product_searches (id) ON DELETE CASCADE,
    CONSTRAINT fk_les_extraction FOREIGN KEY (extraction_id) REFERENCES label_extractions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 검색으로 찾은 제품 후보. 확정 전에는 의류 정보에 섞이지 않는다.
CREATE TABLE product_candidates (
    id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    search_id    BIGINT        NOT NULL,
    name         VARCHAR(300)  NOT NULL,
    brand        VARCHAR(100)  NULL,
    product_code VARCHAR(100)  NULL,
    color_name   VARCHAR(100)  NULL,
    image_url    VARCHAR(1000) NULL,
    source_url   VARCHAR(700)  NOT NULL,
    match_reason VARCHAR(500)  NULL,
    CONSTRAINT uk_pc_search_url UNIQUE (search_id, source_url),
    CONSTRAINT fk_pc_search FOREIGN KEY (search_id) REFERENCES product_searches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 사용자가 '이 제품 선택'으로 확정한 후보. 옷 한 벌에 많아야 하나.
-- 검색 기록은 개별 삭제하지 않는다(회원 탈퇴 때만 함께 지워짐). 그래서 후보 삭제의 CASCADE가 확정 제품을 잃게 하지 않는다.
CREATE TABLE garment_products (
    garment_id   BIGINT      NOT NULL PRIMARY KEY,
    candidate_id BIGINT      NOT NULL,
    confirmed_at DATETIME(6) NOT NULL,
    CONSTRAINT uk_gprod_candidate UNIQUE (candidate_id),
    CONSTRAINT fk_gprod_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE,
    CONSTRAINT fk_gprod_candidate FOREIGN KEY (candidate_id) REFERENCES product_candidates (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 10. 코디
-- ---------------------------------------------------------------------

CREATE TABLE outfits (
    id         BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT      NOT NULL,
    name       VARCHAR(50) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_outfits_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_outfits_name CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 코디를 이루는 옷. 상의·하의 역할은 옷의 세부 종류로 정해지므로 저장하지 않는다
-- ((코디, 역할) → 옷 으로 두면 옷 → 역할 결정자가 후보 키가 아니어서 BCNF 위반).
CREATE TABLE outfit_garments (
    outfit_id  BIGINT NOT NULL,
    garment_id BIGINT NOT NULL,
    PRIMARY KEY (outfit_id, garment_id),
    CONSTRAINT fk_og_outfit FOREIGN KEY (outfit_id) REFERENCES outfits (id) ON DELETE CASCADE,
    CONSTRAINT fk_og_garment FOREIGN KEY (garment_id) REFERENCES garments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 같은 주인 규칙: 연결되는 두 개체는 같은 사용자의 것이어야 한다.
-- 연결 테이블에 user_id를 다시 저장하면 (FK → user_id) 종속이 생겨 BCNF를 깨므로, 저장하지 않고 트리거로 강제한다.
-- 오른쪽 값이 NULL이면(처리 실패 등) 검사하지 않는다.
-- =====================================================================
DELIMITER $$
CREATE TRIGGER trg_storage_space_parents_owner_ins BEFORE INSERT ON storage_space_parents FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM storage_spaces WHERE id = NEW.parent_space_id) IS NOT NULL AND NOT ((SELECT user_id FROM storage_spaces WHERE id = NEW.space_id) <=> (SELECT user_id FROM storage_spaces WHERE id = NEW.parent_space_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:storage_space_parents';
    END IF;
END$$
CREATE TRIGGER trg_storage_space_parents_owner_upd BEFORE UPDATE ON storage_space_parents FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM storage_spaces WHERE id = NEW.parent_space_id) IS NOT NULL AND NOT ((SELECT user_id FROM storage_spaces WHERE id = NEW.space_id) <=> (SELECT user_id FROM storage_spaces WHERE id = NEW.parent_space_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:storage_space_parents';
    END IF;
END$$
CREATE TRIGGER trg_garment_placements_owner_ins BEFORE INSERT ON garment_placements FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_placements';
    END IF;
END$$
CREATE TRIGGER trg_garment_placements_owner_upd BEFORE UPDATE ON garment_placements FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_placements';
    END IF;
END$$
CREATE TRIGGER trg_placement_proposals_owner_ins BEFORE INSERT ON placement_proposals FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:placement_proposals';
    END IF;
END$$
CREATE TRIGGER trg_placement_proposals_owner_upd BEFORE UPDATE ON placement_proposals FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM storage_spaces WHERE id = NEW.space_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:placement_proposals';
    END IF;
END$$
CREATE TRIGGER trg_garment_collections_owner_ins BEFORE INSERT ON garment_collections FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM collections WHERE id = NEW.collection_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM collections WHERE id = NEW.collection_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_collections';
    END IF;
END$$
CREATE TRIGGER trg_garment_collections_owner_upd BEFORE UPDATE ON garment_collections FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM collections WHERE id = NEW.collection_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM collections WHERE id = NEW.collection_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_collections';
    END IF;
END$$
CREATE TRIGGER trg_garment_images_owner_ins BEFORE INSERT ON garment_images FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM images WHERE id = NEW.image_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM images WHERE id = NEW.image_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_images';
    END IF;
END$$
CREATE TRIGGER trg_garment_images_owner_upd BEFORE UPDATE ON garment_images FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM images WHERE id = NEW.image_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM images WHERE id = NEW.image_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_images';
    END IF;
END$$
CREATE TRIGGER trg_image_processings_owner_ins BEFORE INSERT ON image_processings FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM images WHERE id = NEW.result_image_id) IS NOT NULL AND NOT ((SELECT user_id FROM images WHERE id = NEW.source_image_id) <=> (SELECT user_id FROM images WHERE id = NEW.result_image_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:image_processings';
    END IF;
END$$
CREATE TRIGGER trg_image_processings_owner_upd BEFORE UPDATE ON image_processings FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM images WHERE id = NEW.result_image_id) IS NOT NULL AND NOT ((SELECT user_id FROM images WHERE id = NEW.source_image_id) <=> (SELECT user_id FROM images WHERE id = NEW.result_image_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:image_processings';
    END IF;
END$$
CREATE TRIGGER trg_label_extraction_images_owner_ins BEFORE INSERT ON label_extraction_images FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM images WHERE id = NEW.image_id) IS NOT NULL AND NOT ((SELECT user_id FROM label_extractions WHERE id = NEW.extraction_id) <=> (SELECT user_id FROM images WHERE id = NEW.image_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:label_extraction_images';
    END IF;
END$$
CREATE TRIGGER trg_label_extraction_images_owner_upd BEFORE UPDATE ON label_extraction_images FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM images WHERE id = NEW.image_id) IS NOT NULL AND NOT ((SELECT user_id FROM label_extractions WHERE id = NEW.extraction_id) <=> (SELECT user_id FROM images WHERE id = NEW.image_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:label_extraction_images';
    END IF;
END$$
CREATE TRIGGER trg_garment_label_extractions_owner_ins BEFORE INSERT ON garment_label_extractions FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM label_extractions WHERE id = NEW.extraction_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM label_extractions WHERE id = NEW.extraction_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_label_extractions';
    END IF;
END$$
CREATE TRIGGER trg_garment_label_extractions_owner_upd BEFORE UPDATE ON garment_label_extractions FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM label_extractions WHERE id = NEW.extraction_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT user_id FROM label_extractions WHERE id = NEW.extraction_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_label_extractions';
    END IF;
END$$
CREATE TRIGGER trg_label_extraction_searches_owner_ins BEFORE INSERT ON label_extraction_searches FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM product_searches WHERE id = NEW.search_id) IS NOT NULL AND NOT ((SELECT user_id FROM label_extractions WHERE id = NEW.extraction_id) <=> (SELECT user_id FROM product_searches WHERE id = NEW.search_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:label_extraction_searches';
    END IF;
END$$
CREATE TRIGGER trg_label_extraction_searches_owner_upd BEFORE UPDATE ON label_extraction_searches FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM product_searches WHERE id = NEW.search_id) IS NOT NULL AND NOT ((SELECT user_id FROM label_extractions WHERE id = NEW.extraction_id) <=> (SELECT user_id FROM product_searches WHERE id = NEW.search_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:label_extraction_searches';
    END IF;
END$$
CREATE TRIGGER trg_garment_products_owner_ins BEFORE INSERT ON garment_products FOR EACH ROW
BEGIN
    IF (SELECT ps.user_id FROM product_candidates pc JOIN product_searches ps ON ps.id = pc.search_id WHERE pc.id = NEW.candidate_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT ps.user_id FROM product_candidates pc JOIN product_searches ps ON ps.id = pc.search_id WHERE pc.id = NEW.candidate_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_products';
    END IF;
END$$
CREATE TRIGGER trg_garment_products_owner_upd BEFORE UPDATE ON garment_products FOR EACH ROW
BEGIN
    IF (SELECT ps.user_id FROM product_candidates pc JOIN product_searches ps ON ps.id = pc.search_id WHERE pc.id = NEW.candidate_id) IS NOT NULL AND NOT ((SELECT user_id FROM garments WHERE id = NEW.garment_id) <=> (SELECT ps.user_id FROM product_candidates pc JOIN product_searches ps ON ps.id = pc.search_id WHERE pc.id = NEW.candidate_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:garment_products';
    END IF;
END$$
CREATE TRIGGER trg_outfit_garments_owner_ins BEFORE INSERT ON outfit_garments FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM garments WHERE id = NEW.garment_id) IS NOT NULL AND NOT ((SELECT user_id FROM outfits WHERE id = NEW.outfit_id) <=> (SELECT user_id FROM garments WHERE id = NEW.garment_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:outfit_garments';
    END IF;
END$$
CREATE TRIGGER trg_outfit_garments_owner_upd BEFORE UPDATE ON outfit_garments FOR EACH ROW
BEGIN
    IF (SELECT user_id FROM garments WHERE id = NEW.garment_id) IS NOT NULL AND NOT ((SELECT user_id FROM outfits WHERE id = NEW.outfit_id) <=> (SELECT user_id FROM garments WHERE id = NEW.garment_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'owner_mismatch:outfit_garments';
    END IF;
END$$
DELIMITER ;

-- =====================================================================
-- 도메인 값
-- =====================================================================

INSERT INTO categories (code, label) VALUES
    ('TOP', '상의'), ('BOTTOM', '하의'), ('OUTER', '아우터'), ('DRESS', '원피스'), ('ETC', '기타');

INSERT INTO clothing_templates (code, label, category_code) VALUES
    ('SHORT_SLEEVE_TOP', '반소매 상의', 'TOP'),
    ('LONG_SLEEVE_TOP', '긴소매 상의', 'TOP'),
    ('JACKET', '재킷', 'OUTER'),
    ('LONG_PANTS', '긴바지', 'BOTTOM');

INSERT INTO sub_types (code, label, category_code, sort_order) VALUES
    ('SHORT_SLEEVE_TEE', '반소매 티셔츠', 'TOP', 1),
    ('LONG_SLEEVE_TEE', '긴소매 티셔츠', 'TOP', 2),
    ('SHIRT', '셔츠', 'TOP', 3),
    ('KNIT', '니트', 'TOP', 4),
    ('TOP_ETC', '기타 상의', 'TOP', 5),
    ('JACKET', '재킷', 'OUTER', 6),
    ('COAT', '코트', 'OUTER', 7),
    ('OUTER_ETC', '기타 아우터', 'OUTER', 8),
    ('PANTS', '바지', 'BOTTOM', 9),
    ('JEANS', '청바지', 'BOTTOM', 10),
    ('SHORTS', '반바지', 'BOTTOM', 11),
    ('SKIRT', '치마', 'BOTTOM', 12),
    ('BOTTOM_ETC', '기타 하의', 'BOTTOM', 13),
    ('DRESS', '원피스', 'DRESS', 14),
    ('ETC', '기타', 'ETC', 15);

INSERT INTO sub_type_templates (sub_type_code, template_code) VALUES
    ('SHORT_SLEEVE_TEE', 'SHORT_SLEEVE_TOP'),
    ('LONG_SLEEVE_TEE', 'LONG_SLEEVE_TOP'),
    ('SHIRT', 'LONG_SLEEVE_TOP'),
    ('KNIT', 'LONG_SLEEVE_TOP'),
    ('JACKET', 'JACKET'),
    ('PANTS', 'LONG_PANTS'),
    ('JEANS', 'LONG_PANTS');

INSERT INTO seasons (code, label, sort_order) VALUES
    ('SPRING', '봄', 1), ('SUMMER', '여름', 2), ('AUTUMN', '가을', 3), ('WINTER', '겨울', 4);

INSERT INTO garment_statuses (code, label) VALUES
    ('STORED', '보관 중'),
    ('PENDING', '착용·보관 전'),
    ('WASH_WAITING', '세탁 대기'),
    ('WASHING', '세탁 중'),
    ('REPAIRING', '수선 중'),
    ('RETURNED_UNPLACED', '회수 완료·위치 미확인');

INSERT INTO wear_frequencies (code, label, sort_order) VALUES
    ('HIGH', '자주', 1), ('MEDIUM', '보통', 2), ('LOW', '가끔', 3);

INSERT INTO space_types (code, label) VALUES
    ('HANG', '걸기'), ('FOLD', '접기'), ('LONG_TERM', '장기보관');

INSERT INTO care_types (code, label, garment_status_code) VALUES
    ('WASH', '세탁', 'WASHING'), ('REPAIR', '수선', 'REPAIRING');

INSERT INTO care_places (code, label) VALUES
    ('HOME', '자택'), ('SHOP', '업체');

INSERT INTO material_parts (code, label) VALUES
    ('SHELL', '겉감'), ('LINING', '안감'), ('TRIM', '배색'), ('FILL', '충전재');

INSERT INTO fibers (code, label) VALUES
    ('COTTON', '면'), ('POLYESTER', '폴리에스터'), ('WOOL', '울'), ('ACRYLIC', '아크릴'), ('NYLON', '나일론'),
    ('RAYON', '레이온'), ('POLYURETHANE', '폴리우레탄'), ('LINEN', '마'), ('SILK', '실크'), ('CASHMERE', '캐시미어'),
    ('VISCOSE', '비스코스'), ('MODAL', '모달'), ('LYOCELL', '라이오셀'), ('LEATHER', '가죽'), ('DOWN', '다운'),
    ('FEATHER', '페더'), ('OTHER', '기타 섬유');

INSERT INTO measurement_kinds (code, label) VALUES
    ('SECTION', '단면'), ('CIRCUMFERENCE', '둘레'), ('LENGTH', '길이');

INSERT INTO measurement_parts (code, label) VALUES
    ('TOTAL_LENGTH', '총장'), ('SHOULDER', '어깨'), ('CHEST', '가슴'), ('SLEEVE', '소매'),
    ('WAIST', '허리'), ('HIP', '엉덩이'), ('THIGH', '허벅지'), ('RISE', '밑위'), ('HEM', '밑단');

INSERT INTO garment_fields (code, label) VALUES
    ('NAME', '옷 이름'),
    ('BRAND', '브랜드'),
    ('PRODUCT_CODE', '품번'),
    ('COLOR', '색상'),
    ('SIZE_LABEL', '표기 사이즈'),
    ('ORIGIN', '원산지'),
    ('SUB_TYPE', '세부 종류'),
    ('MATERIAL', '소재'),
    ('CARE', '세탁·관리'),
    ('SEASONS', '계절');

INSERT INTO extraction_statuses (code, label) VALUES
    ('PENDING', '분석 중'), ('DONE', '분석 완료'), ('FAILED', '분석 실패');

INSERT INTO search_statuses (code, label) VALUES
    ('SUCCEEDED', '검색 완료'), ('FAILED', '검색 실패');

-- =====================================================================
-- V2: 옮기는 단위(박스·본가·세탁소) 묶음 기록 (R11)
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

-- =====================================================================
-- V3: 범위 정리(수정안 2026-10-29)와 제품 검색 연결 보완
-- =====================================================================

-- 3D 코디·코디 추천(R05·R06)을 범위에서 뺐다. 읽거나 쓰는 코드가 없는 테이블을 지운다(트리거는 테이블과 함께 지워진다).
DROP TABLE outfit_garments;
DROP TABLE outfits;
DROP TABLE body_profiles;

-- 옷 ↔ 그 옷을 등록할 때 한 제품 검색(R02). 택 분석 없이 이름만으로 검색해도 '검색 결과 없음'이 옷 상세에 남게 한다.
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
