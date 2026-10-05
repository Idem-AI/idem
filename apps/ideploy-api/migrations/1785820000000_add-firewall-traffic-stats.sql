-- Up Migration
-- Requests per application and per minute, allowed and blocked, read from the
-- proxy's access log (traffic-ingestion.service.ts). One row per minute keeps
-- the firewall's chart and counters cheap to read whatever the traffic; the
-- detail of blocked requests goes to firewall_traffic_logs.
CREATE TABLE IF NOT EXISTS firewall_traffic_stats (
    application_id bigint NOT NULL,
    bucket timestamptz NOT NULL,
    allowed integer NOT NULL DEFAULT 0,
    blocked integer NOT NULL DEFAULT 0,
    PRIMARY KEY (application_id, bucket)
);
CREATE INDEX IF NOT EXISTS firewall_traffic_stats_bucket_index ON firewall_traffic_stats (bucket);

-- Down Migration
DROP TABLE IF EXISTS firewall_traffic_stats;
