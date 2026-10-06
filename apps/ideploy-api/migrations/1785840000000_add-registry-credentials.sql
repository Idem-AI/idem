-- Up Migration
-- Logins to private image registries (ghcr.io, Docker Hub, …), per team. The
-- password (an access token) is stored encrypted and never returned by the API.
CREATE TABLE IF NOT EXISTS registry_credentials (
    id bigserial PRIMARY KEY,
    team_id bigint NOT NULL,
    registry varchar(255) NOT NULL,
    username varchar(255) NOT NULL,
    password text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (team_id, registry)
);

-- The token a CI pipeline presents to deploy one application (see webhooks).
ALTER TABLE applications ADD COLUMN IF NOT EXISTS manual_webhook_secret_ci varchar(255);

-- Down Migration
ALTER TABLE applications DROP COLUMN IF EXISTS manual_webhook_secret_ci;
DROP TABLE IF EXISTS registry_credentials;
