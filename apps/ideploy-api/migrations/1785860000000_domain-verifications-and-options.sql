-- Up Migration
-- Whether each domain of an application reaches its server (public DNS), as
-- last checked. Only verified domains are routed, and only they keep another
-- team from claiming the same domain (no squatting of a domain one does not own).
CREATE TABLE IF NOT EXISTS domain_verifications (
    application_id bigint NOT NULL,
    host varchar(253) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'missing',
    checked_at timestamptz NOT NULL DEFAULT now(),
    verified_at timestamptz,
    PRIMARY KEY (application_id, host)
);
CREATE INDEX IF NOT EXISTS domain_verifications_host_index ON domain_verifications (host);

-- When the application's routes are served from the proxy's file provider
-- (routes-<uuid>.yml): set by the deployment that switched it, so domain
-- changes can be applied live from then on.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS routes_file_at timestamptz;

-- Domain options.
ALTER TABLE application_settings ADD COLUMN IF NOT EXISTS is_hsts_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE application_settings ADD COLUMN IF NOT EXISTS is_redirect_to_primary_enabled boolean NOT NULL DEFAULT false;

-- Down Migration
ALTER TABLE application_settings DROP COLUMN IF EXISTS is_redirect_to_primary_enabled;
ALTER TABLE application_settings DROP COLUMN IF EXISTS is_hsts_enabled;
ALTER TABLE applications DROP COLUMN IF EXISTS routes_file_at;
DROP TABLE IF EXISTS domain_verifications;
