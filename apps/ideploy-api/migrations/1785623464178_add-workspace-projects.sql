-- The "Project" level the original design called for and the code never built.
--
-- The hierarchy this service was meant to have:
--
--     Team -> Workspace -> Environment -> Project (a frontend, an API, a DB) -> resource
--
-- What actually existed until now: Workspace *is* a row in `projects` (see
-- workspace.service.ts), and every application/database/service attached
-- straight to an environment with no grouping in between — "frontend" and
-- "backend" were never things you could name, only individual resources.
--
-- Named `workspace_projects`, not `projects`: that name is already taken by the
-- table Workspace itself lives in, and reusing it here would make every query
-- ambiguous about which "project" it means.
--
-- `project_id` is nullable on every resource table: a resource created without
-- naming a project is not an error — most workspaces will only ever hold one
-- thing — it is simply ungrouped, and existing rows must stay valid untouched.
--
-- Additive only: new table, nullable new columns. See migrations/README.md.

-- Up Migration

CREATE TABLE IF NOT EXISTS workspace_projects (
  id bigserial PRIMARY KEY,
  uuid uuid NOT NULL UNIQUE,
  name character varying(255) NOT NULL,
  description text,
  environment_id bigint NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  team_id bigint NOT NULL,
  created_at timestamp(0) without time zone NOT NULL DEFAULT now(),
  updated_at timestamp(0) without time zone NOT NULL DEFAULT now(),
  -- Two projects in the same environment cannot share a name — that name is
  -- how a person tells them apart in the interface.
  UNIQUE (environment_id, name)
);

COMMENT ON TABLE workspace_projects IS
  'A named grouping of deployable resources within one workspace environment — "frontend", "backend", "database" — sitting between Environment and the resource tables.';

CREATE INDEX IF NOT EXISTS workspace_projects_environment_id_idx ON workspace_projects (environment_id);
CREATE INDEX IF NOT EXISTS workspace_projects_team_id_idx ON workspace_projects (team_id);

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS project_id bigint REFERENCES workspace_projects(id) ON DELETE SET NULL;
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS project_id bigint REFERENCES workspace_projects(id) ON DELETE SET NULL;
ALTER TABLE standalone_postgresqls
  ADD COLUMN IF NOT EXISTS project_id bigint REFERENCES workspace_projects(id) ON DELETE SET NULL;
ALTER TABLE standalone_mysqls
  ADD COLUMN IF NOT EXISTS project_id bigint REFERENCES workspace_projects(id) ON DELETE SET NULL;
ALTER TABLE standalone_mariadbs
  ADD COLUMN IF NOT EXISTS project_id bigint REFERENCES workspace_projects(id) ON DELETE SET NULL;
ALTER TABLE standalone_mongodbs
  ADD COLUMN IF NOT EXISTS project_id bigint REFERENCES workspace_projects(id) ON DELETE SET NULL;
ALTER TABLE standalone_redis
  ADD COLUMN IF NOT EXISTS project_id bigint REFERENCES workspace_projects(id) ON DELETE SET NULL;
ALTER TABLE standalone_keydbs
  ADD COLUMN IF NOT EXISTS project_id bigint REFERENCES workspace_projects(id) ON DELETE SET NULL;
ALTER TABLE standalone_dragonflies
  ADD COLUMN IF NOT EXISTS project_id bigint REFERENCES workspace_projects(id) ON DELETE SET NULL;
ALTER TABLE standalone_clickhouses
  ADD COLUMN IF NOT EXISTS project_id bigint REFERENCES workspace_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS applications_project_id_idx ON applications (project_id);
CREATE INDEX IF NOT EXISTS services_project_id_idx ON services (project_id);
CREATE INDEX IF NOT EXISTS standalone_postgresqls_project_id_idx ON standalone_postgresqls (project_id);
CREATE INDEX IF NOT EXISTS standalone_mysqls_project_id_idx ON standalone_mysqls (project_id);
CREATE INDEX IF NOT EXISTS standalone_mariadbs_project_id_idx ON standalone_mariadbs (project_id);
CREATE INDEX IF NOT EXISTS standalone_mongodbs_project_id_idx ON standalone_mongodbs (project_id);
CREATE INDEX IF NOT EXISTS standalone_redis_project_id_idx ON standalone_redis (project_id);
CREATE INDEX IF NOT EXISTS standalone_keydbs_project_id_idx ON standalone_keydbs (project_id);
CREATE INDEX IF NOT EXISTS standalone_dragonflies_project_id_idx ON standalone_dragonflies (project_id);
CREATE INDEX IF NOT EXISTS standalone_clickhouses_project_id_idx ON standalone_clickhouses (project_id);

-- Down Migration

ALTER TABLE applications DROP COLUMN IF EXISTS project_id;
ALTER TABLE services DROP COLUMN IF EXISTS project_id;
ALTER TABLE standalone_postgresqls DROP COLUMN IF EXISTS project_id;
ALTER TABLE standalone_mysqls DROP COLUMN IF EXISTS project_id;
ALTER TABLE standalone_mariadbs DROP COLUMN IF EXISTS project_id;
ALTER TABLE standalone_mongodbs DROP COLUMN IF EXISTS project_id;
ALTER TABLE standalone_redis DROP COLUMN IF EXISTS project_id;
ALTER TABLE standalone_keydbs DROP COLUMN IF EXISTS project_id;
ALTER TABLE standalone_dragonflies DROP COLUMN IF EXISTS project_id;
ALTER TABLE standalone_clickhouses DROP COLUMN IF EXISTS project_id;

DROP TABLE IF EXISTS workspace_projects;
