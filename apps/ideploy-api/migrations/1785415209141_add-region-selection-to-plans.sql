-- Choosing where a workspace is hosted becomes a paid capability.
--
-- The existing `features` column cannot express this: it holds an array of
-- marketing strings for display, not machine-readable flags. Gating on a
-- hardcoded list of plan names in application code would put a pricing decision
-- somewhere nobody thinks to look, so it lives on the plan row.
--
-- Additive only: Eloquent ignores columns it does not know about, so the Laravel
-- app keeps working untouched (see migrations/README.md for the ownership rule).

-- Up Migration

ALTER TABLE idem_subscription_plans
  ADD COLUMN IF NOT EXISTS allows_region_selection boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN idem_subscription_plans.allows_region_selection IS
  'When true, a workspace on this plan may pick its hosting region; otherwise the default region is used.';

-- Paid tiers get the choice. Free and basic deploy to the default region.
UPDATE idem_subscription_plans
   SET allows_region_selection = true
 WHERE name IN ('pro', 'enterprise');

-- Down Migration

ALTER TABLE idem_subscription_plans
  DROP COLUMN IF EXISTS allows_region_selection;
