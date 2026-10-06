-- Up Migration
-- What happened when a service was started, stopped or restarted: the console
-- output is kept, so it can be read while the operation runs (polling — it did
-- not depend on the realtime channel any more) and after it ended.
CREATE TABLE IF NOT EXISTS service_operations (
    id bigserial PRIMARY KEY,
    service_id bigint NOT NULL,
    action varchar(20) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'running',
    output text NOT NULL DEFAULT '',
    started_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS service_operations_service_index ON service_operations (service_id, id DESC);

-- Down Migration
DROP TABLE IF EXISTS service_operations;
