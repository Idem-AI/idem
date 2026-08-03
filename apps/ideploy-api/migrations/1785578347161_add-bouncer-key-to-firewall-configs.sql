-- Separate the credential that goes into a Docker label from the one that can
-- change firewall decisions.
--
-- `crowdsec_api_key` is used to manage decisions: create bans, remove them,
-- register bouncers. The Laravel side puts that same key into the Traefik
-- middleware label, which means it is readable by anyone who can run
-- `docker inspect` on the server — and it is enough to lift every ban.
--
-- A bouncer only ever needs to *read* decisions. Giving it its own credential
-- keeps the management key server-side, where it belongs.
--
-- Additive only: Eloquent ignores columns it does not know about, so the Laravel
-- app keeps working untouched (see migrations/README.md).

-- Up Migration

ALTER TABLE firewall_configs
  ADD COLUMN IF NOT EXISTS crowdsec_bouncer_key text;

COMMENT ON COLUMN firewall_configs.crowdsec_bouncer_key IS
  'Read-only CrowdSec bouncer credential, emitted in the Traefik middleware label. Distinct from crowdsec_api_key, which manages decisions and must stay server-side.';

-- Down Migration

ALTER TABLE firewall_configs
  DROP COLUMN IF EXISTS crowdsec_bouncer_key;
