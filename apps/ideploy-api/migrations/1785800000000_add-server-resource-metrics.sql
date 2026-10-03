-- Free resources of each server, as last measured by the health sweep
-- (server-health.service.ts), so placement can send a new workspace to the
-- server of its zone that is most ready to receive it
-- (server-scheduling.service.ts).
--
-- Capacity already has columns (cpu_cores, ram_mb, disk_gb); what was missing
-- is what is still free and how fresh that reading is. resources_updated_at is
-- what lets placement ignore a server whose figures are stale.
--
-- Additive only: new columns on an existing table. See migrations/README.md.

-- Up Migration

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS load_1m numeric(8,2),
  ADD COLUMN IF NOT EXISTS mem_available_mb integer,
  ADD COLUMN IF NOT EXISTS disk_free_gb integer,
  ADD COLUMN IF NOT EXISTS resources_updated_at timestamp with time zone;

-- Down Migration

ALTER TABLE servers
  DROP COLUMN IF EXISTS resources_updated_at,
  DROP COLUMN IF EXISTS disk_free_gb,
  DROP COLUMN IF EXISTS mem_available_mb,
  DROP COLUMN IF EXISTS load_1m;
