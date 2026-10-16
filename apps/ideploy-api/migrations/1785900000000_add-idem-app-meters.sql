-- Up Migration
-- Compteurs prépayés des applications (modèle économique IDEM, octobre 2026).
-- IDEM débite chaque jour le compteur d'une application depuis le portefeuille de
-- son propriétaire et écrit ici l'état VOULU (`status`) : `active` (l'application
-- tourne), `asleep` (solde épuisé, ou offre gratuite arrivée au bout de son essai :
-- l'application est arrêtée, jamais supprimée), `archived` (endormie depuis plus de
-- 30 jours). Le balayage d'iDeploy arrête ou relance l'application et note l'état
-- appliqué (`applied_status`) : un écart entre les deux colonnes est un travail à faire.
CREATE TABLE IF NOT EXISTS idem_app_meters (
    application_uuid varchar(255) PRIMARY KEY,
    status varchar(20) NOT NULL DEFAULT 'active',
    tier varchar(30) NOT NULL DEFAULT 'veille',
    updated_at timestamptz NOT NULL DEFAULT now(),
    applied_status varchar(20),
    applied_at timestamptz,
    last_error text
);
CREATE INDEX IF NOT EXISTS idem_app_meters_pending_index ON idem_app_meters (status, applied_status);

-- Down Migration
DROP TABLE IF EXISTS idem_app_meters;
