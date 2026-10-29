
-- =====================================================================
-- V4: 회수 완료 시각과 맡긴 날 비교를 서울 날짜로
-- =====================================================================

-- completed_at은 Hibernate가 UTC로 저장하고(Instant), dropped_on은 서울 날짜다(Dates.ZONE).
-- DATE(completed_at)로 비교하면 서울 00~09시에 오늘 맡긴 옷을 회수할 때 하루 앞선 날짜가 되어 막힌다.
-- 서울은 일광 절약 시간이 없어 9시간을 더하면 서울 날짜가 된다(CHECK에는 시간대 이름 함수를 쓸 수 없다).
ALTER TABLE care_events DROP CONSTRAINT ck_ce_completed;
ALTER TABLE care_events ADD CONSTRAINT ck_ce_completed
    CHECK (completed_at IS NULL OR DATE(completed_at + INTERVAL 9 HOUR) >= dropped_on);
