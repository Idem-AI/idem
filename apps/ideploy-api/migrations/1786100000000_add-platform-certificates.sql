-- Up Migration
-- Le certificat joker de la plateforme (`*.idem.africa`), obtenu par défi DNS-01 et
-- copié sur les serveurs gérés par IDEM (platform-certificate.service.ts). La clé
-- privée et la clé du compte ACME sont chiffrées (APP_KEY, format Laravel).
CREATE TABLE IF NOT EXISTS platform_certificates (
  domain varchar(255) PRIMARY KEY,
  certificate text NOT NULL,
  private_key text NOT NULL,
  account_key text,
  expires_at timestamptz NOT NULL,
  fingerprint varchar(64) NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE IF EXISTS platform_certificates;
