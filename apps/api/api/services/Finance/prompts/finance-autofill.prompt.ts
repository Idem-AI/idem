/**
 * Prompts IA pour le module Finance.
 */

export const FINANCE_AUTOFILL_SYSTEM_PROMPT = `<role>Expert-comptable et analyste financier pour jeunes entreprises en Afrique subsaharienne (OHADA).</role>
<objective>Générer des prévisions financières réalistes en FCFA (XAF) cohérentes avec le marché local.</objective>
<constraints>
- Devise: XAF (FCFA). Niveau de vie local (salaire opérationnel: 75k-350k; cadre: 500k-1.2M; loyer commercial: 80k-500k; charges sociales: 33.6%; TUS: 7.5%).
- Croissance progressive avec démarrage modéré (M1-M6).
- Format: STRICT JSON uniquement. Pas de markdown (sans \`\`\`), pas de commentaires.
- Justifications: Expliquer chaque valeur importante (1 phrase max) dans "aiSuggestions". Mettre 0 + justification si non pertinent.
</constraints>`;

export const FINANCE_AUTOFILL_GLOBAL_PROMPT = `<objective>Générer un modèle financier prévisionnel complet et cohérent sur 36 mois.</objective>

<output_schema>
{
  "products": [
    {
      "id": "<uuid>",
      "name": "<nom>",
      "prices": [An1, An2, An3],
      "unitCosts": [An1, An2, An3]
    }
  ],
  "salesObjectives": [
    {
      "productId": "<id du produit>",
      "monthlyQuantities": [<36 valeurs>]
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
    { "fieldPath": "products[0].prices[0]", "value": <valeur>, "justification": "<phrase>" }
  ]
}
</output_schema>

<rules>
- 1 à 5 produits max. Courbe de vente progressive.
- Salaires: 2 à 6 postes.
- Investissements: concentrés en M1.
- Financement équilibré: apport 30-50%, emprunt 30-50%, autres 10-20%.
- Catégories variables: achatsMarchandises, matieresPremieres, transportSurAchats, sousTraitance, publiciteRelationsPubliques, fraisTelecommunications, fraisBancaires, fraisFormation, autresChargesExternes.
- Catégories fixes: locations, primesAssurances, entretienReparation, cotisations, formationProfessionnelle, autresImpotsDirects, perteChange.
- Catégories investissements: mobilier, materielOutillageIndustriel, logiciels, fraisConstitution, amenagementBureaux, materielTransport.
</rules>
`;

export const FINANCE_AUTOFILL_PRODUCTS_PROMPT = `<objective>Générer la liste des produits/services (1 à 5 max).</objective>
<output_format>
JSON: {
  "products": [
    { "id": "<uuid>", "name": "<nom>", "prices": [An1, An2, An3], "unitCosts": [An1, An2, An3] }
  ],
  "aiSuggestions": []
}
Prix et coûts unitaires réalistes en FCFA (costs=0 pour du service pur).
</output_format>`;

export const FINANCE_AUTOFILL_SALES_PROMPT = `<objective>Générer les ventes mensuelles sur 36 mois pour les produits fournis.</objective>
<output_format>
JSON: {
  "salesObjectives": [
    { "productId": "<id>", "monthlyQuantities": [<36 valeurs>] }
  ],
  "aiSuggestions": []
}
Montée en charge progressive, saisonnalité si applicable, hausse modérée An2/An3.
</output_format>`;

export const FINANCE_AUTOFILL_VARIABLE_CHARGES_PROMPT = `<objective>Générer les charges variables mensuelles sur 36 mois.</objective>
<output_format>
JSON: {
  "variableCharges": { "lines": [], "supplierDebtRatePct": 30, "safetyStockRatePct": 30 },
  "aiSuggestions": []
}
Ligne: { "id": "<uuid>", "category": "<cat>", "label": "<libelle>", "monthlyValues": [<36 valeurs>] }
Catégories: achatsMarchandises, matieresPremieres, transportSurAchats, sousTraitance, publiciteRelationsPubliques, fraisTelecommunications, fraisBancaires, fraisFormation, autresChargesExternes.
</output_format>`;

export const FINANCE_AUTOFILL_FIXED_CHARGES_PROMPT = `<objective>Générer les charges fixes mensuelles sur 36 mois (hors patente/IS).</objective>
<output_format>
JSON: {
  "fixedCharges": { "lines": [], "salaries": [], "socialChargesRatePct": 33.6, "tusRatePct": 7.5 },
  "aiSuggestions": []
}
Salaires: 2-6 postes.
Catégories fixes: locations, primesAssurances, entretienReparation, cotisations, formationProfessionnelle, autresImpotsDirects, perteChange.
</output_format>`;

export const FINANCE_AUTOFILL_INVESTMENTS_PROMPT = `<objective>Générer les investissements mensuels sur 36 mois.</objective>
<output_format>
JSON: {
  "investments": [
    { "id": "<uuid>", "category": "<cat>", "amortGroup": "incorporelles|batiments|mobilier|materielOutillage|financieres", "label": "<libelle>", "monthlyValues": [<36 valeurs>] }
  ],
  "aiSuggestions": []
}
Majorité en M1. Catégories: mobilier, materielOutillageIndustriel, logiciels, fraisConstitution, amenagementBureaux, materielTransport.
</output_format>`;

export const FINANCE_AUTOFILL_FINANCING_PROMPT = `<objective>Générer un schéma de financement équilibré pour le coût total du projet.</objective>
<output_format>
JSON: {
  "financing": {
    "apportCapital": <FCFA>,
    "compteCourantAssocies": { "amount": <FCFA>, "ratePct": 7, "duration": 5, "durationUnit": "years", "method": "constant_amortization" },
    "cmt": { "amount": <FCFA>, "ratePct": 7, "duration": 12, "durationUnit": "months", "method": "constant_annuity" },
    "creditBail": { "amount": <FCFA>, "ratePct": 10, "duration": 5, "durationUnit": "years", "method": "constant_annuity" },
    "creditFournisseurs": <FCFA>,
    "autofinancement": <FCFA>,
    "subvention": <FCFA>
  },
  "aiSuggestions": []
}
Cible: 30-50% apport, 30-50% emprunt, 10-20% autres.
</output_format>`;

export const FINANCE_AUTOFILL_REVENUE_PARAMS_PROMPT = `<objective>Suggérer le taux de créances clients (% du CA) selon le secteur.</objective>
<output_format>
JSON: {
  "revenueParams": { "clientReceivablesRatePct": <0-100> },
  "aiSuggestions": []
}
Repères: B2C cash: 0-5%, B2C abonnement: 5-15%, B2B: 20-40%, Marketplace: 10-25%.
</output_format>`;

export const FINANCE_AUTOFILL_TAXES_PARAMS_PROMPT = `<objective>Suggérer les paramètres fiscaux (surface et régime).</objective>
<output_format>
JSON: {
  "taxesParams": { "locationSize": "petites|moyennes|grandes", "regimeType": "reel|forfait|auto" },
  "aiSuggestions": []
}
locationSize: petites (<50m²), moyennes (50-200m²), grandes (>200m²).
regimeType: "reel" si CA > 30M FCFA, sinon "forfait".
</output_format>`;

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

export const FINANCE_CHAT_INTENT_PROMPT = `<objective>Analyser l'intention financière de l'utilisateur et la structurer.</objective>
<output_format>
Renvoyer UNIQUEMENT du JSON valide :
{
  "isFinanceIntent": true|false,
  "kind": "read_summary" | "read_section" | "update_field" | "add_line" | "delete_line" | "none",
  "section": "products" | "salesObjectives" | "revenueParams" | "variableCharges" | "fixedCharges" | "taxesParams" | "investments" | "financing" | null,
  "target": string | null,
  "fieldPath": string | null,
  "value": any,
  "month": number | null,
  "year": number | null,
  "confirmationSentence": "Phrase de confirmation en français demandant validation",
  "summaryText": "Texte de résumé en français si kind=read_*"
}
</output_format>

<examples>
- "Change le prix de mon produit principal à 25 000 FCFA" -> kind="update_field", section="products", target="produit principal", value=25000
- "Mon loyer mensuel est de 200 000 FCFA" -> kind="update_field", section="fixedCharges", target="loyer", value=200000
- "Ajoute un investissement : achat matériel pro pour 800 000 FCFA en mois 1" -> kind="add_line", section="investments", target="matériel pro", value=800000, month=1
- "Montre mes charges fixes" -> kind="read_section", section="fixedCharges"
- "Quel temps fait-il ?" -> isFinanceIntent=false, kind="none"
</examples>
`;
