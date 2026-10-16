-- Up Migration
-- Plan « metered » : le modèle économique IDEM ne vend plus de plans iDeploy. Chaque
-- application a son compteur prépayé, tenu par IDEM (`idem_app_meters`) ; le plan ne
-- limite donc plus le nombre d'applications (-1 = sans limite). Un serveur BYOS est
-- compris ; le choix de la région est une option du compteur (résidence nationale).
INSERT INTO idem_subscription_plans
  (name, display_name, price, currency, billing_period, app_limit, server_limit,
   features, allows_region_selection, is_active, sort_order, created_at, updated_at)
SELECT 'metered', 'Au compteur', 0, 'XAF', 'monthly', -1, 1,
       '["Applications illimitées","Compteur prépayé par application","Payé au jour depuis le portefeuille IDEM"]',
       true, true, 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM idem_subscription_plans WHERE name = 'metered');

-- Down Migration
DELETE FROM idem_subscription_plans WHERE name = 'metered';
