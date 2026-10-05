-- Up Migration
-- The HTTP status of a recorded request: "Recent traffic" shows allowed
-- requests too now, and a 200 and a 500 are not the same news.
ALTER TABLE firewall_traffic_logs ADD COLUMN IF NOT EXISTS status_code smallint;

-- Down Migration
ALTER TABLE firewall_traffic_logs DROP COLUMN IF EXISTS status_code;
