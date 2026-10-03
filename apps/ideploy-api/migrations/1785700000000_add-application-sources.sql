-- The code of an application that has no Git repository: what iCode sends when
-- a user publishes the site or application they built there.
--
-- iCode's users have never heard of GitHub, and asking them to create an
-- account, a repository and a token just to put their site online is exactly
-- the wall the product exists to remove. iCode already holds the files; it
-- sends them, iDeploy keeps them here as a gzipped tar, and the deployment
-- worker unpacks them on the server where it would otherwise have cloned.
--
-- One row per application, replaced on every publish — the deployment history
-- keeps the images, not the sources. `applications.git_repository` stays as it
-- is (NOT NULL, Laravel-owned): an application deployed from here has an empty
-- one, which the worker already reads as "nothing to clone".
--
-- Additive only: new table. See migrations/README.md.

-- Up Migration

CREATE TABLE IF NOT EXISTS application_sources (
  application_id bigint PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  archive bytea NOT NULL,
  file_count integer NOT NULL,
  byte_size integer NOT NULL,
  origin character varying(32) NOT NULL DEFAULT 'icode',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE IF EXISTS application_sources;
