-- Whole-application rate limiting and concurrency capping.
--
-- Laravel's own "rate limit" templates (RateLimitTemplateService) are not rate
-- limiting: they are request_path/user_agent pattern rules whose `rate_limit`
-- metadata (window, threshold, tracking) is generated for the description text
-- and then never persisted — FirewallRule::create() does not save it, and
-- nothing reads it back to actually count anything. That is admitted in the
-- service's own docblock ("not true rate limiting... planned for future
-- release").
--
-- Traefik's native `ratelimit`/`inflightreq` middlewares are real, immediately
-- available, and need no AppSec. The trade honestly stated: they apply to the
-- whole application, not to one path pattern the way the fake Laravel templates
-- implied — a router-level limit cannot single out `/login` from `/`.
--
-- Additive only: Eloquent ignores columns it does not know about, so the
-- Laravel app keeps working untouched (see migrations/README.md).

-- Up Migration

ALTER TABLE firewall_configs
  ADD COLUMN IF NOT EXISTS rate_limit_average integer,
  ADD COLUMN IF NOT EXISTS rate_limit_burst integer,
  ADD COLUMN IF NOT EXISTS rate_limit_period_seconds integer,
  ADD COLUMN IF NOT EXISTS concurrency_limit integer,
  ADD COLUMN IF NOT EXISTS rate_limit_template character varying(50);

COMMENT ON COLUMN firewall_configs.rate_limit_average IS
  'Sustained requests per second per client address, enforced by Traefik''s native ratelimit middleware. NULL means no rate limit is configured.';
COMMENT ON COLUMN firewall_configs.rate_limit_burst IS
  'Requests a client may send in a short spike above the average before being refused.';
COMMENT ON COLUMN firewall_configs.rate_limit_period_seconds IS
  'Window the average is computed over.';
COMMENT ON COLUMN firewall_configs.concurrency_limit IS
  'Simultaneous in-flight requests allowed per client address, enforced by Traefik''s native inflightreq middleware. NULL means uncapped.';
COMMENT ON COLUMN firewall_configs.rate_limit_template IS
  'Which named preset produced the current numbers, or ''custom''. Display only — enforcement reads the numeric columns, never this key.';

-- Down Migration

ALTER TABLE firewall_configs
  DROP COLUMN IF EXISTS rate_limit_average,
  DROP COLUMN IF EXISTS rate_limit_burst,
  DROP COLUMN IF EXISTS rate_limit_period_seconds,
  DROP COLUMN IF EXISTS concurrency_limit,
  DROP COLUMN IF EXISTS rate_limit_template;
