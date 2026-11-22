-- Up Migration
-- .com : 8 900 F → 9 400 F (enregistrement et renouvellement).
--
-- À 8 900 F, le coût réel annoncé par Domain Name API (11,99 $ × 577 = 6 918 F) ne laissait que
-- 1 020 F de marge (11,5 %), sous la marge minimale de 15 % des règles : le moteur refusait l'offre
-- et le .com restait « Pas commandable pour l'instant ». 9 400 F rend 1 480 F (15,7 %) et couvre
-- jusqu'à ~12,40 $ de coût. Le prix pack (7 100 F, vente financée) ne change pas.
--
-- Comme `setCatalogPrice` : la ligne active est fermée, une nouvelle est ouverte (on retrouve
-- toujours le tarif qu'un client a vu), et l'audit le garde. Rien n'est fait si le prix a déjà été
-- changé en console (ligne active différente du tarif de départ).

WITH before AS (
  SELECT * FROM public_price_catalog
   WHERE tld = 'com' AND valid_to IS NULL AND register_xaf = 8900 AND renew_xaf = 8900
), closed AS (
  UPDATE public_price_catalog p SET valid_to = now() FROM before b WHERE p.id = b.id RETURNING p.*
), opened AS (
  INSERT INTO public_price_catalog (tld, register_xaf, renew_xaf, transfer_xaf, pack_xaf, on_sale, created_by, note)
  SELECT tld, 9400, 9400, transfer_xaf, pack_xaf, on_sale, 'migration',
         'Marge minimale de 15 % au coût réel Domain Name API (11,99 $)'
    FROM closed
  RETURNING *
)
INSERT INTO audit_logs (actor_kind, actor_id, action, target_type, target_id, data)
SELECT 'system', 'migration:1790000000001', 'catalog.price_set', 'tld', 'com',
       jsonb_build_object('before', to_jsonb(c), 'after', to_jsonb(o))
  FROM closed c, opened o;

-- Down Migration
-- Retour à 8 900 F, seulement si la ligne active est celle posée par cette migration.

WITH current_row AS (
  SELECT * FROM public_price_catalog
   WHERE tld = 'com' AND valid_to IS NULL AND created_by = 'migration' AND register_xaf = 9400
), closed AS (
  UPDATE public_price_catalog p SET valid_to = now() FROM current_row c WHERE p.id = c.id RETURNING p.*
)
INSERT INTO public_price_catalog (tld, register_xaf, renew_xaf, transfer_xaf, pack_xaf, on_sale, created_by, note)
SELECT tld, 8900, 8900, transfer_xaf, pack_xaf, on_sale, 'migration', 'Retour au tarif de départ'
  FROM closed;
