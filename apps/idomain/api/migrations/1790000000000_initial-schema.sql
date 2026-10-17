-- Up Migration
-- iDomain — schéma initial.
--
-- Trois séparations portent tout le reste :
--   1. le PRIX PUBLIC (public_price_catalog, en francs) n'est jamais le COÛT FOURNISSEUR
--      (provider_costs, dans la devise du fournisseur) ;
--   2. le domaine a son identifiant interne, indépendant du registrar (registrar_ref à part) ;
--   3. ce qui a été présenté et retenu est HISTORISÉ : chaque ligne de commande garde le prix
--      montré, la ligne de catalogue et les règles appliquées, le coût retenu et le deuxième
--      meilleur, la marge — de quoi mesurer la rentabilité réelle et trancher un litige.
-- Les montants en francs sont des entiers (F CFA, sans centimes).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Fournisseurs ───────────────────────────────────────────────────────────

CREATE TABLE registrar_providers (
    code varchar(40) PRIMARY KEY,
    name varchar(120) NOT NULL,
    enabled boolean NOT NULL DEFAULT false,
    -- Départage à coût égal (plus petit = préféré).
    priority integer NOT NULL DEFAULT 100,
    currency varchar(3) NOT NULL DEFAULT 'USD',
    -- Abonnement revendeur annuel, réparti sur le volume attendu (part du coût de chaque opération).
    membership_fee_year numeric(12, 2) NOT NULL DEFAULT 0,
    expected_operations_year integer NOT NULL DEFAULT 100 CHECK (expected_operations_year > 0),
    -- Frais fixes par opération (dans la devise du fournisseur), en plus du prix de l'extension.
    fee_per_operation numeric(12, 4) NOT NULL DEFAULT 0,
    -- État mesuré par le contrôle de santé : 'up' | 'degraded' | 'down' | 'unknown'.
    health_status varchar(20) NOT NULL DEFAULT 'unknown',
    health_checked_at timestamptz,
    health_detail text,
    -- Solde du compte revendeur (alerte de rechargement).
    balance numeric(14, 2),
    balance_checked_at timestamptz,
    -- Seuil d'alerte du solde, dans la devise du fournisseur.
    balance_alert_below numeric(14, 2) NOT NULL DEFAULT 50,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ce que chaque fournisseur sait faire, par extension. Rien n'est supposé : sans ligne, pas d'offre.
CREATE TABLE provider_capabilities (
    provider_code varchar(40) NOT NULL REFERENCES registrar_providers (code) ON DELETE CASCADE,
    tld varchar(63) NOT NULL,
    can_register boolean NOT NULL DEFAULT false,
    can_renew boolean NOT NULL DEFAULT false,
    can_transfer boolean NOT NULL DEFAULT false,
    can_restore boolean NOT NULL DEFAULT false,
    manages_dns boolean NOT NULL DEFAULT false,
    supports_promotions boolean NOT NULL DEFAULT false,
    min_years smallint NOT NULL DEFAULT 1,
    max_years smallint NOT NULL DEFAULT 10,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider_code, tld)
);

-- Le dernier coût connu, par fournisseur / extension / opération / durée. `source` : relevé par
-- l'API du fournisseur ('api') ou saisi depuis la console ('manual', grille négociée).
CREATE TABLE provider_costs (
    provider_code varchar(40) NOT NULL REFERENCES registrar_providers (code) ON DELETE CASCADE,
    tld varchar(63) NOT NULL,
    operation varchar(20) NOT NULL CHECK (operation IN ('register', 'renew', 'transfer', 'restore')),
    years smallint NOT NULL DEFAULT 1,
    cost numeric(12, 4) NOT NULL CHECK (cost >= 0),
    currency varchar(3) NOT NULL,
    source varchar(20) NOT NULL DEFAULT 'api',
    fetched_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider_code, tld, operation, years)
);

-- Chaque devis réellement obtenu (recherche, revalidation avant achat) : l'historique des coûts.
CREATE TABLE provider_price_quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_code varchar(40) NOT NULL,
    domain_name varchar(253) NOT NULL,
    operation varchar(20) NOT NULL,
    years smallint NOT NULL,
    available boolean,
    premium boolean NOT NULL DEFAULT false,
    cost numeric(12, 4),
    currency varchar(3),
    total_cost_xaf integer,
    admissible boolean NOT NULL DEFAULT false,
    reason varchar(80),
    context varchar(20) NOT NULL DEFAULT 'search',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_price_quotes_domain_idx ON provider_price_quotes (domain_name, created_at DESC);

-- Taux de pilotage (jamais affichés) : francs pour une unité de la devise.
CREATE TABLE fx_rates (
    currency varchar(3) PRIMARY KEY,
    xaf_per_unit numeric(12, 4) NOT NULL CHECK (xaf_per_unit > 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Prix publics et règles ────────────────────────────────────────────────

-- Une ligne par version de prix d'une extension ; la ligne active (valid_to IS NULL) fait foi.
-- Un changement de prix ferme l'ancienne ligne et en ouvre une nouvelle : rien n'est réécrit.
CREATE TABLE public_price_catalog (
    id bigserial PRIMARY KEY,
    tld varchar(63) NOT NULL,
    register_xaf integer CHECK (register_xaf > 0),
    renew_xaf integer CHECK (renew_xaf > 0),
    transfer_xaf integer CHECK (transfer_xaf > 0),
    -- Au coût : dans un pack, ou avec le forfait Entreprise.
    pack_xaf integer CHECK (pack_xaf > 0),
    on_sale boolean NOT NULL DEFAULT true,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_to timestamptz,
    created_by varchar(128) NOT NULL DEFAULT 'system',
    note text
);
CREATE UNIQUE INDEX public_price_catalog_active_idx ON public_price_catalog (tld) WHERE valid_to IS NULL;

-- Les règles commerciales, versionnées de la même façon (une seule active).
CREATE TABLE pricing_rules (
    id bigserial PRIMARY KEY,
    rules jsonb NOT NULL,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_to timestamptz,
    created_by varchar(128) NOT NULL DEFAULT 'system'
);
CREATE UNIQUE INDEX pricing_rules_active_idx ON pricing_rules ((true)) WHERE valid_to IS NULL;

-- On ne descend sous le prix plancher que si la différence est financée (plan économique §9.2).
CREATE TABLE promotions (
    id bigserial PRIMARY KEY,
    tld varchar(63) NOT NULL,
    operation varchar(20) NOT NULL DEFAULT 'register' CHECK (operation IN ('register', 'renew', 'transfer')),
    price_xaf integer NOT NULL CHECK (price_xaf > 0),
    funding varchar(20) NOT NULL CHECK (funding IN ('pack', 'registry', 'budget')),
    -- Promotion du registre : le coût fournisseur pendant la promotion, s'il diffère.
    registry_cost numeric(12, 4),
    registry_cost_currency varchar(3),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    max_uses integer,
    uses integer NOT NULL DEFAULT 0,
    note text,
    created_by varchar(128) NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);
CREATE INDEX promotions_active_idx ON promotions (tld, operation, starts_at, ends_at);

-- ─── Titulaires ─────────────────────────────────────────────────────────────

-- Les coordonnées que les registres exigent du titulaire. `owner_uid` = uid IDEM (immuable).
CREATE TABLE domain_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_uid varchar(128) NOT NULL,
    first_name varchar(80) NOT NULL,
    last_name varchar(80) NOT NULL,
    company varchar(120),
    email varchar(254) NOT NULL,
    phone_country_code varchar(4) NOT NULL,
    phone varchar(16) NOT NULL,
    address varchar(200) NOT NULL,
    city varchar(80) NOT NULL,
    state varchar(80),
    postal_code varchar(16),
    country varchar(2) NOT NULL,
    is_default boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX domain_contacts_owner_idx ON domain_contacts (owner_uid);
CREATE UNIQUE INDEX domain_contacts_default_idx ON domain_contacts (owner_uid) WHERE is_default;

-- ─── Domaines ───────────────────────────────────────────────────────────────

CREATE TABLE domains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_uid varchar(128) NOT NULL,
    name varchar(253) NOT NULL,
    tld varchar(63) NOT NULL,
    -- 'pending' | 'active' | 'expired' | 'transferring' | 'failed' | 'external'
    status varchar(20) NOT NULL DEFAULT 'pending',
    -- Qui l'a enregistré (NULL pour un domaine externe connecté) et sa référence chez lui.
    registrar_code varchar(40) REFERENCES registrar_providers (code),
    registrar_ref varchar(120),
    -- 'managed' : zone tenue par iDomain chez le registrar ; 'external' : DNS ailleurs, guidé.
    dns_mode varchar(20) NOT NULL DEFAULT 'managed',
    contact_id uuid REFERENCES domain_contacts (id),
    registered_at timestamptz,
    expires_at timestamptz,
    renewal_xaf integer,
    source varchar(20) NOT NULL DEFAULT 'idomain',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
-- Un nom n'appartient qu'à un seul compte tant qu'il n'est pas en échec.
CREATE UNIQUE INDEX domains_name_live_idx ON domains (name) WHERE status <> 'failed';
CREATE INDEX domains_owner_idx ON domains (owner_uid, created_at DESC);
CREATE INDEX domains_expiry_idx ON domains (expires_at) WHERE status = 'active';

-- ─── Sessions de prix et commandes ─────────────────────────────────────────

-- Le prix montré au client, figé pour la durée de la session de commande.
CREATE TABLE price_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_uid varchar(128) NOT NULL,
    domain_name varchar(253) NOT NULL,
    operation varchar(20) NOT NULL,
    years smallint NOT NULL,
    price_xaf integer NOT NULL,
    renewal_xaf integer,
    at_cost boolean NOT NULL DEFAULT false,
    catalog_id bigint NOT NULL REFERENCES public_price_catalog (id),
    rules_id bigint NOT NULL REFERENCES pricing_rules (id),
    promotion_id bigint REFERENCES promotions (id),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_sessions_owner_idx ON price_sessions (owner_uid, created_at DESC);

-- Un parcours ouvert par un produit IDEM (iDeploy, iCode) pour une application : on y revient.
CREATE TABLE domain_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_uid varchar(128) NOT NULL,
    source varchar(20) NOT NULL CHECK (source IN ('ideploy', 'icode', 'idomain')),
    app_uuid varchar(64),
    app_name varchar(255),
    environment varchar(40) NOT NULL DEFAULT 'production',
    return_url text,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX domain_sessions_owner_idx ON domain_sessions (owner_uid, created_at DESC);

CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_uid varchar(128) NOT NULL,
    -- 'awaiting_contact' | 'awaiting_payment' | 'paid' | 'processing' | 'completed'
    -- | 'on_hold' (marge ou disponibilité à revoir) | 'needs_review' (résultat incertain)
    -- | 'failed' | 'refunded' | 'cancelled'
    status varchar(20) NOT NULL,
    total_xaf integer NOT NULL CHECK (total_xaf >= 0),
    -- 'wallet' (portefeuille IDEM) | 'prepaid' (pack, payé ailleurs).
    payment_method varchar(20) NOT NULL DEFAULT 'wallet',
    source varchar(20) NOT NULL DEFAULT 'idomain',
    session_id uuid REFERENCES domain_sessions (id),
    idempotency_key varchar(120) NOT NULL,
    status_reason text,
    -- Référence d'une commande importée depuis l'API IDEM (Mongo `domain_orders`).
    legacy_ref varchar(64),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_uid, idempotency_key)
);
CREATE INDEX orders_owner_idx ON orders (owner_uid, created_at DESC);
CREATE INDEX orders_status_idx ON orders (status, updated_at);
CREATE UNIQUE INDEX orders_legacy_idx ON orders (legacy_ref) WHERE legacy_ref IS NOT NULL;

CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    domain_name varchar(253) NOT NULL,
    tld varchar(63) NOT NULL,
    operation varchar(20) NOT NULL CHECK (operation IN ('register', 'renew', 'transfer')),
    years smallint NOT NULL CHECK (years BETWEEN 1 AND 10),
    -- Ce que le client paie, et ce que coûtera le renouvellement (annoncé dès la commande).
    price_xaf integer NOT NULL CHECK (price_xaf >= 0),
    renewal_xaf integer,
    at_cost boolean NOT NULL DEFAULT false,
    price_session_id uuid REFERENCES price_sessions (id),
    catalog_id bigint REFERENCES public_price_catalog (id),
    rules_id bigint REFERENCES pricing_rules (id),
    promotion_id bigint REFERENCES promotions (id),
    -- 'pending' | 'registering' | 'registered' | 'on_hold' | 'needs_review' | 'failed'
    status varchar(20) NOT NULL DEFAULT 'pending',
    -- Le choix du moteur au moment de l'achat (pas à la recherche).
    provider_code varchar(40),
    provider_cost numeric(12, 4),
    provider_currency varchar(3),
    provider_cost_xaf integer,
    second_provider_code varchar(40),
    second_cost_xaf integer,
    margin_xaf integer,
    domain_id uuid REFERENCES domains (id),
    -- Domaine externe ou transfert : code d'autorisation (jamais journalisé).
    auth_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

-- Débits et restitutions du portefeuille IDEM. Une restitution n'existe qu'une fois par débit.
CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders (id),
    kind varchar(20) NOT NULL CHECK (kind IN ('charge', 'refund')),
    amount_xaf integer NOT NULL CHECK (amount_xaf >= 0),
    -- Référence envoyée à IDEM : la même référence ne débite (ou ne rembourse) jamais deux fois.
    reference varchar(120) NOT NULL UNIQUE,
    ledger_entry_id varchar(64),
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
    error text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON payments (order_id);

-- ─── Opérations chez les fournisseurs ──────────────────────────────────────

-- Chaque appel qui change quelque chose chez un registrar. Une opération au résultat INCERTAIN
-- (délai dépassé) est vérifiée chez le fournisseur avant toute nouvelle tentative.
CREATE TABLE domain_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id uuid REFERENCES order_items (id),
    domain_id uuid REFERENCES domains (id),
    kind varchar(20) NOT NULL CHECK (kind IN ('register', 'renew', 'transfer', 'restore', 'nameservers')),
    provider_code varchar(40) NOT NULL,
    idempotency_key varchar(160) NOT NULL UNIQUE,
    -- 'running' | 'succeeded' | 'failed' | 'uncertain'
    status varchar(20) NOT NULL DEFAULT 'running',
    attempts integer NOT NULL DEFAULT 0,
    last_attempt_at timestamptz,
    error_code varchar(80),
    error text,
    response jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX domain_operations_item_idx ON domain_operations (order_item_id);
CREATE INDEX domain_operations_status_idx ON domain_operations (status, updated_at);

-- ─── DNS et connexion aux applications ────────────────────────────────────

-- Le domaine relié à une application iDeploy : la chaîne DNS → rattachement → routage → HTTPS.
CREATE TABLE domain_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_uid varchar(128) NOT NULL,
    -- NULL pour un domaine externe (pas enregistré par iDomain).
    domain_id uuid REFERENCES domains (id),
    host varchar(253) NOT NULL,
    -- Le `www.` du même nom, branché avec lui.
    include_www boolean NOT NULL DEFAULT true,
    target varchar(20) NOT NULL DEFAULT 'ideploy',
    app_uuid varchar(64) NOT NULL,
    environment varchar(40) NOT NULL DEFAULT 'production',
    session_id uuid REFERENCES domain_sessions (id),
    -- 'managed' (iDomain écrit la zone) | 'manual' (l'utilisateur écrit, iDomain vérifie).
    dns_method varchar(20) NOT NULL,
    -- 'pending' | 'awaiting_domain' | 'verifying_ownership' | 'configuring_dns' | 'attaching'
    -- | 'waiting_dns' | 'activating_tls' | 'active' | 'failed' | 'detached'
    status varchar(30) NOT NULL DEFAULT 'pending',
    target_ip varchar(45),
    last_check jsonb,
    attempts integer NOT NULL DEFAULT 0,
    last_attempt_at timestamptz,
    error text,
    activated_at timestamptz,
    -- Début de la tentative en cours (une relance repart de zéro sans réécrire created_at).
    cycle_started_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX domain_connections_owner_idx ON domain_connections (owner_uid, created_at DESC);
CREATE INDEX domain_connections_app_idx ON domain_connections (app_uuid);
-- Un même nom n'est relié qu'à une application à la fois.
CREATE UNIQUE INDEX domain_connections_host_live_idx ON domain_connections (host) WHERE status NOT IN ('failed', 'detached');

-- Preuve de contrôle d'un domaine externe : un enregistrement TXT à poser.
CREATE TABLE domain_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id uuid NOT NULL REFERENCES domain_connections (id) ON DELETE CASCADE,
    method varchar(20) NOT NULL DEFAULT 'txt',
    record_name varchar(253) NOT NULL,
    token varchar(80) NOT NULL,
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Chaque modification de zone, avec ce qu'il y avait avant : la restauration est possible.
CREATE TABLE dns_changes (
    id bigserial PRIMARY KEY,
    domain_id uuid NOT NULL REFERENCES domains (id),
    connection_id uuid REFERENCES domain_connections (id),
    actor_uid varchar(128),
    action varchar(10) NOT NULL CHECK (action IN ('add', 'delete')),
    name varchar(253) NOT NULL,
    type varchar(10) NOT NULL,
    content text NOT NULL,
    ttl integer,
    reverted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dns_changes_domain_idx ON dns_changes (domain_id, created_at DESC);

-- ─── Événements vers les produits ─────────────────────────────────────────

CREATE TABLE webhook_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event varchar(60) NOT NULL,
    target varchar(40) NOT NULL,
    url text NOT NULL,
    payload jsonb NOT NULL,
    -- 'pending' | 'delivered' | 'failed' (abandon après la dernière tentative)
    status varchar(20) NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0,
    last_status integer,
    last_error text,
    delivered_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_status_idx ON webhook_deliveries (status, created_at);

-- ─── Audit ──────────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
    id bigserial PRIMARY KEY,
    actor_kind varchar(20) NOT NULL CHECK (actor_kind IN ('user', 'admin', 'system', 'service')),
    actor_id varchar(128),
    action varchar(80) NOT NULL,
    target_type varchar(40),
    target_id varchar(128),
    data jsonb,
    request_id varchar(80),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_target_idx ON audit_logs (target_type, target_id, created_at DESC);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);

-- ─── Valeurs de départ ─────────────────────────────────────────────────────

-- Règles du plan économique §9.2 : f = 3 % d'encaissement, b = 5 % de coussin de change,
-- m = 15 % de marge minimale, 250 F de support par commande ; devis figé 30 minutes.
INSERT INTO pricing_rules (rules) VALUES ('{
  "paymentFeeRate": 0.03,
  "fxCushionRate": 0.05,
  "minMarginRate": 0.15,
  "supportCostXaf": 250,
  "priceSessionMinutes": 30,
  "degradedPenaltyXaf": 300,
  "maxYears": 5,
  "allowLossOnFundedPromotions": true
}');

-- 1 $ = 577 F (taux de pilotage du plan économique, à revoir chaque trimestre).
INSERT INTO fx_rates (currency, xaf_per_unit) VALUES ('USD', 577), ('EUR', 655.957), ('XAF', 1);

-- Les deux extensions déjà vendues par l'API IDEM (DOMAIN_PRICES, offer.model.ts), reprises telles quelles.
INSERT INTO public_price_catalog (tld, register_xaf, renew_xaf, pack_xaf, note) VALUES
  ('africa', 6500, 8000, 4900, 'Repris de DOMAIN_PRICES (API IDEM) — plan économique §9.2'),
  ('com', 8900, 8900, 7100, 'Repris de DOMAIN_PRICES (API IDEM) — plan économique §9.2');

INSERT INTO registrar_providers (code, name, enabled, priority, currency, membership_fee_year, expected_operations_year) VALUES
  ('domainnameapi', 'Domain Name API', true, 10, 'USD', 0, 100),
  ('openprovider', 'Openprovider', false, 20, 'USD', 49.92, 100),
  ('simulated', 'Fournisseur simulé (développement)', false, 999, 'USD', 0, 100);

-- Coûts relevés dans le plan économique §9.2 (« à confirmer » : remplacés par le relevé API
-- au premier passage du worker, ou depuis la console).
INSERT INTO provider_capabilities (provider_code, tld, can_register, can_renew, can_transfer, manages_dns) VALUES
  ('domainnameapi', 'com', true, true, true, true),
  ('openprovider', 'africa', true, true, true, false),
  ('simulated', 'com', true, true, true, true),
  ('simulated', 'africa', true, true, true, true);
INSERT INTO provider_costs (provider_code, tld, operation, years, cost, currency, source) VALUES
  ('domainnameapi', 'com', 'register', 1, 11.31, 'USD', 'manual'),
  ('domainnameapi', 'com', 'renew', 1, 11.31, 'USD', 'manual'),
  ('openprovider', 'africa', 'register', 1, 7.70, 'USD', 'manual'),
  ('openprovider', 'africa', 'renew', 1, 9.70, 'USD', 'manual'),
  ('simulated', 'com', 'register', 1, 10.00, 'USD', 'manual'),
  ('simulated', 'com', 'renew', 1, 10.00, 'USD', 'manual'),
  ('simulated', 'africa', 'register', 1, 7.00, 'USD', 'manual'),
  ('simulated', 'africa', 'renew', 1, 9.00, 'USD', 'manual');

-- Down Migration
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS dns_changes;
DROP TABLE IF EXISTS domain_verifications;
DROP TABLE IF EXISTS domain_connections;
DROP TABLE IF EXISTS domain_operations;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS domain_sessions;
DROP TABLE IF EXISTS price_sessions;
DROP TABLE IF EXISTS domains;
DROP TABLE IF EXISTS domain_contacts;
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS pricing_rules;
DROP TABLE IF EXISTS public_price_catalog;
DROP TABLE IF EXISTS fx_rates;
DROP TABLE IF EXISTS provider_price_quotes;
DROP TABLE IF EXISTS provider_costs;
DROP TABLE IF EXISTS provider_capabilities;
DROP TABLE IF EXISTS registrar_providers;
