-- dropped_on은 한국 날짜를 쓰므로, completed_at의 날짜 비교도 한국(UTC+9) 기준으로 맞춘다.
ALTER TABLE care_events
    DROP CONSTRAINT ck_ce_completed,
    ADD CONSTRAINT ck_ce_completed
        CHECK (completed_at IS NULL OR DATE(DATE_ADD(completed_at, INTERVAL 9 HOUR)) >= dropped_on);
