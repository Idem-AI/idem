-- Up Migration
-- Un seul fournisseur réel : Domain Name API, dont le catalogue est mis en vente par le code.
--
--   1. Openprovider est retiré : aucun connecteur n'a jamais été écrit, ses coûts saisis à la main
--      (.africa) ne pouvaient servir à rien — un nom n'est vendu que confirmé en direct. Ses
--      capacités et coûts partent avec lui (ON DELETE CASCADE) ; ses devis historisés aussi.
--   2. .africa sort de la vente : plus aucun fournisseur ne le propose, la recherche affichait
--      « Vérification impossible ». La ligne est posée à la main (`migration`) : la mise en vente
--      automatique ne la remettra pas en vente, même si Domain Name API l'ajoute un jour.

DELETE FROM provider_price_quotes WHERE provider_code = 'openprovider';
DELETE FROM registrar_providers p
 WHERE p.code = 'openprovider'
   AND NOT EXISTS (SELECT 1 FROM domains d WHERE d.registrar_code = p.code);

WITH before AS (
  SELECT * FROM public_price_catalog WHERE tld = 'africa' AND valid_to IS NULL AND on_sale
), closed AS (
  UPDATE public_price_catalog p SET valid_to = now() FROM before b WHERE p.id = b.id RETURNING p.*
), opened AS (
  INSERT INTO public_price_catalog (tld, register_xaf, renew_xaf, transfer_xaf, pack_xaf, on_sale, created_by, note)
  SELECT tld, register_xaf, renew_xaf, transfer_xaf, pack_xaf, false, 'migration', 'Retiré : aucun fournisseur actif ne le propose'
    FROM closed
  RETURNING *
)
INSERT INTO audit_logs (actor_kind, actor_id, action, target_type, target_id, data)
SELECT 'system', 'migration:1790000000002', 'catalog.price_set', 'tld', 'africa',
       jsonb_build_object('before', to_jsonb(c), 'after', to_jsonb(o))
  FROM closed c, opened o;

-- Down Migration
-- .africa remis en vente au tarif qu'il avait ; Openprovider recréé désactivé, avec ses coûts saisis.

WITH current_row AS (
  SELECT * FROM public_price_catalog WHERE tld = 'africa' AND valid_to IS NULL AND NOT on_sale AND created_by = 'migration'
), closed AS (
  UPDATE public_price_catalog p SET valid_to = now() FROM current_row c WHERE p.id = c.id RETURNING p.*
)
INSERT INTO public_price_catalog (tld, register_xaf, renew_xaf, transfer_xaf, pack_xaf, on_sale, created_by, note)
SELECT tld, register_xaf, renew_xaf, transfer_xaf, pack_xaf, true, 'migration', 'Remis en vente'
  FROM closed;

INSERT INTO registrar_providers (code, name, enabled, priority, currency, membership_fee_year, expected_operations_year)
VALUES ('openprovider', 'Openprovider', false, 20, 'USD', 49.92, 100)
ON CONFLICT (code) DO NOTHING;
INSERT INTO provider_capabilities (provider_code, tld, can_register, can_renew, can_transfer, manages_dns)
VALUES ('openprovider', 'africa', true, true, true, false)
ON CONFLICT DO NOTHING;
INSERT INTO provider_costs (provider_code, tld, operation, years, cost, currency, source) VALUES
  ('openprovider', 'africa', 'register', 1, 7.70, 'USD', 'manual'),
  ('openprovider', 'africa', 'renew', 1, 9.70, 'USD', 'manual')
ON CONFLICT DO NOTHING;
