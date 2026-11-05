# Corpus d'exemples du moteur graphique

160 pages écrites à la main (HTML Tailwind aux jetons de marque, textes en clés `{{clé}}`), 20 par support, et 20 de plus pour la charte en PAYSAGE (`ch21`–`ch40`, `page-a4-landscape`, `pages-ch-3/4`, ossature `charterL`) :
`pages-bp-*` business plan · `pages-pd-*` pitch deck · `pages-ch-*` charte · `pages-cd-*` cartes de visite ·
`pages-fl-*` visuels réseaux · `pages-cv-*` couvertures de documents · `pages-pc-*` couvertures de profil.
Marques fictives (`brands.ts`), aucun appel de modèle.

    npm run corpus:render        # rend les pages dans corpus/rendered (html + png + json)
    npm run corpus:build         # library/examples.json      (tri : ≤ 2 foyers d'attention)
    npm run corpus:build:all     # library/examples.all.json  (toutes les pages affichées)

Brancher une bibliothèque : `IDEM_EXAMPLES_FILE=<chemin>`. Planche-contact : `python3 scripts/sheet.py corpus/rendered bp 5 500`.
