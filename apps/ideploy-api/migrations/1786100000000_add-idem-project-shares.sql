-- Up Migration
-- Équipes de projet IDEM (novembre 2026).
-- Le propriétaire d'un projet IDEM peut ouvrir l'espace « Mise en ligne » à un
-- membre de son équipe. IDEM (l'API centrale, propriétaire de cette vérité) écrit
-- ici, pour chaque membre concerné, l'équipe iDeploy du propriétaire, les
-- applications reliées au projet et le niveau accordé. iDeploy laisse alors ce
-- membre ouvrir l'équipe du propriétaire, restreint à ces seules applications :
-- `read` pour voir (état, journaux, déploiements), `write` pour agir (déployer,
-- redémarrer, variables, domaine). Supprimer l'application ou toucher au reste de
-- l'équipe reste au propriétaire. Le membre est désigné par son uid IDEM : sa ligne
-- `users` n'existe peut-être pas encore (elle naît à sa première connexion).
CREATE TABLE IF NOT EXISTS idem_project_shares (
    id bigserial PRIMARY KEY,
    idem_project_id varchar(128) NOT NULL,
    project_name varchar(255) NOT NULL DEFAULT '',
    owner_team_id bigint NOT NULL,
    owner_name varchar(255) NOT NULL DEFAULT '',
    member_idem_uid varchar(255) NOT NULL,
    level varchar(10) NOT NULL,
    application_uuids text[] NOT NULL DEFAULT '{}',
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT idem_project_shares_level_check CHECK (level IN ('read', 'write')),
    CONSTRAINT idem_project_shares_unique UNIQUE (idem_project_id, member_idem_uid)
);
CREATE INDEX IF NOT EXISTS idem_project_shares_member_index ON idem_project_shares (member_idem_uid, owner_team_id);

-- Down Migration
DROP TABLE IF EXISTS idem_project_shares;
