/**
 * Prompts IA pour le module Finance.
 *
 * Chaque prompt vise à produire un JSON strictement conforme à la section
 * concernée du FinanceModel. Le service back se charge de valider et fusionner.
 *
 * RÈGLE: l'IA doit renvoyer UNIQUEMENT du JSON (aucun markdown, aucun texte
 * avant/après). Pour chaque champ proposé, fournir une justification courte
 * (1 phrase) que l'on stockera dans meta.aiSuggestions.
 */

export const FINANCE_AUTOFILL_SYSTEM_PROMPT = `Tu es un expert-comptable et analyste financier spécialisé dans l'accompagnement
de jeunes entreprises africaines (Afrique subsaharienne francophone principalement).
Tu génères des prévisions financières réalistes en FCFA (XAF) cohérentes avec le
marché local, les coûts pratiqués, la fiscalité OHADA et le niveau de maturité du projet.

CONTRAINTES STRICTES:
- Devise par défaut: XAF (FCFA). Prix unitaires, salaires, loyers, etc. à des
  niveaux REALISTES pour l'Afrique subsaharienne, PAS occidentaux.
- Salaires mensuels typiques: 75 000 à 350 000 FCFA pour un poste opérationnel,
  500 000 à 1 200 000 FCFA pour un cadre dirigeant.
- Loyers commerciaux Yaoundé/Douala/Dakar/Abidjan: 80 000 à 500 000 FCFA/mois selon zone.
- Charges sociales: 33,6% du brut. TUS: 7,5%.
- Patente annuelle progressive selon CA (cf. paramètres fournis).
- Croissance: réaliste. Démarrage progressif les 6 premiers mois.
- Renvoie UNIQUEMENT du JSON valide, sans markdown, sans \`\`\`, sans commentaires.
- Pour chaque valeur importante, ajoute une entrée dans "aiSuggestions" avec une
  justification courte (1 phrase max).
- Si un champ n'a pas de sens pour le projet (ex: matières premières pour du
  service pur), mets 0 et explique pourquoi dans aiSuggestions.`;

// ===================================================================
// AUTO-FILL GLOBAL
// ===================================================================

export const FINANCE_AUTOFILL_GLOBAL_PROMPT = `Génère un modèle financier prévisionnel COMPLET et COHÉRENT pour ce projet sur 36 mois.

Tu dois renvoyer un JSON respectant strictement le schéma suivant:
{
  "products": [
    {
      "id": "<uuid>",
      "name": "<nom>",
      "prices": [<prix An1>, <prix An2>, <prix An3>],
      "unitCosts": [<cout An1>, <cout An2>, <cout An3>]
    }
  ],
  "salesObjectives": [
    {
      "productId": "<id du produit ci-dessus>",
      "monthlyQuantities": [<q M1>, <q M2>, ..., <q M36>]
    }
  ],
  "revenueParams": { "clientReceivablesRatePct": <0-100> },
  "variableCharges": {
    "lines": [
      { "id": "<uuid>", "category": "<cat>", "label": "<libelle>", "monthlyValues": [<36 valeurs>] }
    ],
    "supplierDebtRatePct": 30,
    "safetyStockRatePct": 30
  },
  "fixedCharges": {
    "lines": [
      { "id": "<uuid>", "category": "<cat>", "label": "<libelle>", "monthlyValues": [<36 valeurs>] }
    ],
    "salaries": [
      { "id": "<uuid>", "position": "<poste>", "monthlyValues": [<36 valeurs>] }
    ],
    "socialChargesRatePct": 33.6,
    "tusRatePct": 7.5
  },
  "investments": [
    { "id": "<uuid>", "category": "<cat>", "amortGroup": "incorporelles|batiments|mobilier|materielOutillage|financieres", "label": "<libelle>", "monthlyValues": [<36 valeurs>] }
  ],
  "financing": {
    "apportCapital": <FCFA>,
    "compteCourantAssocies": { "amount": <FCFA>, "ratePct": 7, "duration": 5, "durationUnit": "years", "method": "constant_amortization" },
    "cmt": { "amount": <FCFA>, "ratePct": 7, "duration": 12, "durationUnit": "months", "method": "constant_annuity" },
    "creditBail": { "amount": <FCFA>, "ratePct": 10, "duration": 5, "durationUnit": "years", "method": "constant_annuity" },
    "creditFournisseurs": <FCFA>,
    "autofinancement": <FCFA>,
    "subvention": <FCFA>
  },
  "aiSuggestions": [
    { "fieldPath": "<chemin du champ ex: products[0].prices[0]>", "value": <valeur>, "justification": "<phrase>" }
  ]
}

RÈGLES COMPLÉMENTAIRES:
- 1 à 5 produits maximum selon la nature du projet
- Quantités vendues mensuelles: courbe de montée en charge progressive (faible M1-M3, croissance jusqu'à un plateau)
- Charges variables: uniquement les postes pertinents (laisser à 0 ou omettre les autres)
- Salaires: 2 à 6 postes selon taille équipe; démarrer avec l'essentiel
- Investissements: matériel/aménagements de démarrage en M1, peu d'invests après
- Schéma de financement équilibré: apport ~30-50%, emprunt ~30-50%, autres ~10-20%
- Catégories valides charges variables: achatsMarchandises, matieresPremieres, transportSurAchats, sousTraitance, publiciteRelationsPubliques, fraisTelecommunications, fraisBancaires, fraisFormation, autresChargesExternes
- Catégories valides charges fixes: locations, primesAssurances, entretienReparation, patentesLicences (mettre 0, calculé auto)
- Catégories valides investissements: mobilier, materielOutillageIndustriel, logiciels, fraisConstitution, amenagementBureaux, materielTransport`;

// ===================================================================
// AUTO-FILL PAR SECTION
// ===================================================================

export const FINANCE_AUTOFILL_PRODUCTS_PROMPT = `Génère la liste des produits/services à commercialiser pour ce projet.
Renvoie un JSON: { "products": [...], "aiSuggestions": [...] } où chaque produit suit:
{ "id": "<uuid>", "name": "<nom court>", "prices": [<an1>, <an2>, <an3>], "unitCosts": [<an1>, <an2>, <an3>] }

- 1 à 5 produits/services maximum
- Prix réalistes pour le marché africain ciblé (FCFA)
- unitCosts = coût d'achat ou de revient unitaire (peut être 0 pour du service pur)
- Légère augmentation possible An2/An3 (inflation modérée)`;

export const FINANCE_AUTOFILL_SALES_PROMPT = `Génère les objectifs de ventes mensuels sur 36 mois pour les produits fournis.
Renvoie un JSON: { "salesObjectives": [...], "aiSuggestions": [...] } où chaque objectif suit:
{ "productId": "<id du produit>", "monthlyQuantities": [<q1>, <q2>, ..., <q36>] }

- Courbe de montée en charge: faible au démarrage (M1-M3), croissance progressive, plateau
- Saisonnalité si pertinente pour le secteur
- An2 et An3 globalement supérieurs à An1 mais réalistes`;

export const FINANCE_AUTOFILL_VARIABLE_CHARGES_PROMPT = `Génère les charges variables mensuelles sur 36 mois.
Renvoie un JSON: { "variableCharges": { "lines": [...], "supplierDebtRatePct": 30, "safetyStockRatePct": 30 }, "aiSuggestions": [...] }
Chaque ligne: { "id": "<uuid>", "category": "<cat>", "label": "<libelle>", "monthlyValues": [<36 valeurs>] }

Catégories valides: achatsMarchandises, matieresPremieres, transportSurAchats, sousTraitance,
publiciteRelationsPubliques, fraisTelecommunications, fraisBancaires, fraisFormation, autresChargesExternes
Ne pas inclure les catégories non pertinentes pour le projet.`;

export const FINANCE_AUTOFILL_FIXED_CHARGES_PROMPT = `Génère les charges fixes mensuelles sur 36 mois (hors patente/IS qui sont calculés automatiquement).
Renvoie un JSON: { "fixedCharges": { "lines": [...], "salaries": [...], "socialChargesRatePct": 33.6, "tusRatePct": 7.5 }, "aiSuggestions": [...] }

Salaires: 2 à 6 postes selon la taille équipe.
Catégories charges fixes valides: locations, primesAssurances, entretienReparation, cotisations,
formationProfessionnelle, autresImpotsDirects, perteChange`;

export const FINANCE_AUTOFILL_INVESTMENTS_PROMPT = `Génère la liste des investissements (CAPEX) mensuels sur 36 mois.
Renvoie un JSON: { "investments": [...], "aiSuggestions": [...] }
Chaque investissement: { "id": "<uuid>", "category": "<cat>", "amortGroup": "<group>", "label": "<libelle>", "monthlyValues": [<36 valeurs>] }

amortGroup valide: incorporelles | batiments | mobilier | materielOutillage | financieres
Catégories typiques: mobilier, materielOutillageIndustriel, logiciels, fraisConstitution, amenagementBureaux, materielTransport
La majorité des investissements en M1 (démarrage), éventuellement quelques renforcements ponctuels.`;

export const FINANCE_AUTOFILL_FINANCING_PROMPT = `Génère un schéma de financement équilibré et réaliste.
Renvoie un JSON: { "financing": {...}, "aiSuggestions": [...] }

Structure attendue:
{
  "apportCapital": <FCFA>,
  "compteCourantAssocies": { "amount": <FCFA>, "ratePct": 7, "duration": 5, "durationUnit": "years", "method": "constant_amortization" },
  "cmt": { "amount": <FCFA>, "ratePct": 7, "duration": 12, "durationUnit": "months", "method": "constant_annuity" },
  "creditBail": { "amount": <FCFA>, "ratePct": 10, "duration": 5, "durationUnit": "years", "method": "constant_annuity" },
  "creditFournisseurs": <FCFA>,
  "autofinancement": <FCFA>,
  "subvention": <FCFA>
}

Répartition cible: 30-50% apport, 30-50% emprunt, 10-20% autres sources.
Le total doit couvrir le coût total estimé du projet (investissements + BFR).`;

export const FINANCE_AUTOFILL_REVENUE_PARAMS_PROMPT = `Suggère un taux de créances clients (% du CA) cohérent avec le secteur.
Renvoie: { "revenueParams": { "clientReceivablesRatePct": <0-100> }, "aiSuggestions": [...] }

- B2C cash: 0-5%
- B2C abonnement: 5-15%
- B2B: 20-40% selon usages
- Marketplace/services: 10-25%`;

export const FINANCE_AUTOFILL_TAXES_PARAMS_PROMPT = `Suggère les paramètres fiscaux adaptés au projet.
Renvoie: { "taxesParams": { "locationSize": "petites|moyennes|grandes", "regimeType": "reel|forfait|auto", ... }, "aiSuggestions": [...] }

- locationSize selon surface des locaux estimée: petites (< 50m²), moyennes (50-200m²), grandes (> 200m²)
- regimeType par défaut: "reel" pour CA > 30M FCFA, sinon "forfait"
- Conserve les autres taux par défaut sauf raison spécifique.`;

// ===================================================================
// HELPER: mapping section -> prompt
// ===================================================================

export const FINANCE_SECTION_PROMPTS: Record<string, string> = {
  products: FINANCE_AUTOFILL_PRODUCTS_PROMPT,
  salesObjectives: FINANCE_AUTOFILL_SALES_PROMPT,
  variableCharges: FINANCE_AUTOFILL_VARIABLE_CHARGES_PROMPT,
  fixedCharges: FINANCE_AUTOFILL_FIXED_CHARGES_PROMPT,
  investments: FINANCE_AUTOFILL_INVESTMENTS_PROMPT,
  financing: FINANCE_AUTOFILL_FINANCING_PROMPT,
  revenueParams: FINANCE_AUTOFILL_REVENUE_PARAMS_PROMPT,
  taxesParams: FINANCE_AUTOFILL_TAXES_PARAMS_PROMPT,
};

// ===================================================================
// CHAT INTENT PARSING
// ===================================================================

export const FINANCE_CHAT_INTENT_PROMPT = `Tu es un parseur d'intentions pour un module Finance. À partir d'un message utilisateur,
détermine si l'intention concerne le module Finance et, si oui, structure-la.

Tu DOIS renvoyer UNIQUEMENT du JSON valide selon ce schéma:
{
  "isFinanceIntent": true|false,
  "kind": "read_summary" | "read_section" | "update_field" | "add_line" | "delete_line" | "none",
  "section": "products" | "salesObjectives" | "revenueParams" | "variableCharges" | "fixedCharges" | "taxesParams" | "investments" | "financing" | null,
  "target": "<libelle du poste/produit visé ou null>",
  "fieldPath": "<chemin du champ à modifier, ex: products[0].prices[0]>",
  "value": <nouvelle valeur si applicable, sinon null>,
  "month": <index mois 1-36 si applicable, sinon null>,
  "year": <index année 1-7 si applicable, sinon null>,
  "confirmationSentence": "<phrase de confirmation à présenter à l'utilisateur, en français>",
  "summaryText": "<si kind=read_*, texte de résumé en français, sinon null>"
}

Exemples:
- "Change le prix de mon produit principal à 25 000 FCFA"
  -> kind="update_field", section="products", target="produit principal", value=25000
- "Mon loyer mensuel est de 200 000 FCFA"
  -> kind="update_field", section="fixedCharges", target="loyer", value=200000
- "Ajoute un investissement : achat matériel informatique pour 800 000 FCFA en mois 1"
  -> kind="add_line", section="investments", target="matériel informatique", value=800000, month=1
- "Montre-moi mes charges fixes actuelles"
  -> kind="read_section", section="fixedCharges"
- "Résume-moi mes finances actuelles"
  -> kind="read_summary"
- "Quel temps fait-il ?"
  -> isFinanceIntent=false, kind="none"

IMPORTANT: si une modification est demandée, génère une "confirmationSentence" claire et naturelle
qui demande la confirmation à l'utilisateur avant d'appliquer la modification.`;
