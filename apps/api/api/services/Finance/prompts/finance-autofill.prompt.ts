/**
 * Prompts IA du module Finance.
 *
 * Rédigés en anglais comme tous les prompts du projet. Restent en français : les
 * clés de schéma (elles nomment des champs du modèle) et les exemples d'énoncés
 * utilisateur, qui reproduisent ce que les utilisateurs écrivent réellement.
 */

export const FINANCE_AUTOFILL_SYSTEM_PROMPT = `<role>Chartered accountant and financial analyst for early-stage companies in sub-Saharan Africa (OHADA).</role>
<objective>Produce realistic financial projections in FCFA (XAF), consistent with the local market.</objective>
<constraints>
- Currency: XAF (FCFA). Local cost of living (operational salary: 75k-350k; manager: 500k-1.2M; commercial rent: 80k-500k; social charges: 33.6%; TUS: 7.5%).
- Progressive growth with a moderate ramp-up (M1-M6).
- Format: STRICT JSON only. No markdown (no \`\`\`), no comments.
- Justifications: explain every significant value (one sentence max) in "aiSuggestions". Use 0 plus a justification when a line is not relevant.
- Every text you emit (product names, charge labels, job titles, justifications) is written IN FRENCH: it is displayed as-is in the user's financial plan.
</constraints>`;

export const FINANCE_AUTOFILL_GLOBAL_PROMPT = `<objective>Produce a complete, coherent 36-month financial model.</objective>

<output_schema>
{
  "products": [
    {
      "id": "<uuid>",
      "name": "<name>",
      "prices": [year1, year2, year3],
      "unitCosts": [year1, year2, year3]
    }
  ],
  "salesObjectives": [
    {
      "productId": "<product id>",
      "monthlyQuantities": [<36 values>]
    }
  ],
  "revenueParams": { "clientReceivablesRatePct": <0-100> },
  "variableCharges": {
    "lines": [
      { "id": "<uuid>", "category": "<cat>", "label": "<label>", "monthlyValues": [<36 values>] }
    ],
    "supplierDebtRatePct": 30,
    "safetyStockRatePct": 30
  },
  "fixedCharges": {
    "lines": [
      { "id": "<uuid>", "category": "<cat>", "label": "<label>", "monthlyValues": [<36 values>] }
    ],
    "salaries": [
      { "id": "<uuid>", "position": "<role>", "monthlyValues": [<36 values>] }
    ],
    "socialChargesRatePct": 33.6,
    "tusRatePct": 7.5
  },
  "investments": [
    { "id": "<uuid>", "category": "<cat>", "amortGroup": "incorporelles|batiments|mobilier|materielOutillage|financieres", "label": "<label>", "monthlyValues": [<36 values>] }
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
    { "fieldPath": "products[0].prices[0]", "value": <value>, "justification": "<one sentence, in French>" }
  ]
}
</output_schema>

<rules>
- 1 to 5 products maximum. A progressive sales curve.
- Salaries: 2 to 6 positions.
- Investments: concentrated in M1.
- Balanced funding: equity 30-50%, debt 30-50%, other 10-20%.
- Variable-charge categories: achatsMarchandises, matieresPremieres, transportSurAchats, sousTraitance, publiciteRelationsPubliques, fraisTelecommunications, fraisBancaires, fraisFormation, autresChargesExternes.
- Fixed-charge categories: locations, primesAssurances, entretienReparation, cotisations, formationProfessionnelle, autresImpotsDirects, perteChange.
- Investment categories: mobilier, materielOutillageIndustriel, logiciels, fraisConstitution, amenagementBureaux, materielTransport.
</rules>
`;

export const FINANCE_AUTOFILL_PRODUCTS_PROMPT = `<objective>Produce the list of products and services (1 to 5 maximum).</objective>
<output_format>
JSON: {
  "products": [
    { "id": "<uuid>", "name": "<name>", "prices": [year1, year2, year3], "unitCosts": [year1, year2, year3] }
  ],
  "aiSuggestions": []
}
Realistic prices and unit costs in FCFA (unitCosts = 0 for a pure service).
</output_format>`;

export const FINANCE_AUTOFILL_SALES_PROMPT = `<objective>Produce 36 months of monthly sales for the supplied products.</objective>
<output_format>
JSON: {
  "salesObjectives": [
    { "productId": "<id>", "monthlyQuantities": [<36 values>] }
  ],
  "aiSuggestions": []
}
Progressive ramp-up, seasonality where applicable, moderate growth in year 2 and year 3.
</output_format>`;

export const FINANCE_AUTOFILL_VARIABLE_CHARGES_PROMPT = `<objective>Produce 36 months of monthly variable charges.</objective>
<output_format>
JSON: {
  "variableCharges": { "lines": [], "supplierDebtRatePct": 30, "safetyStockRatePct": 30 },
  "aiSuggestions": []
}
Line shape: { "id": "<uuid>", "category": "<cat>", "label": "<label>", "monthlyValues": [<36 values>] }
Categories: achatsMarchandises, matieresPremieres, transportSurAchats, sousTraitance, publiciteRelationsPubliques, fraisTelecommunications, fraisBancaires, fraisFormation, autresChargesExternes.
</output_format>`;

export const FINANCE_AUTOFILL_FIXED_CHARGES_PROMPT = `<objective>Produce 36 months of monthly fixed charges (excluding business licence and corporate income tax).</objective>
<output_format>
JSON: {
  "fixedCharges": { "lines": [], "salaries": [], "socialChargesRatePct": 33.6, "tusRatePct": 7.5 },
  "aiSuggestions": []
}
Salaries: 2-6 positions.
Fixed-charge categories: locations, primesAssurances, entretienReparation, cotisations, formationProfessionnelle, autresImpotsDirects, perteChange.
</output_format>`;

export const FINANCE_AUTOFILL_INVESTMENTS_PROMPT = `<objective>Produce 36 months of monthly investments.</objective>
<output_format>
JSON: {
  "investments": [
    { "id": "<uuid>", "category": "<cat>", "amortGroup": "incorporelles|batiments|mobilier|materielOutillage|financieres", "label": "<label>", "monthlyValues": [<36 values>] }
  ],
  "aiSuggestions": []
}
Most of them in M1. Categories: mobilier, materielOutillageIndustriel, logiciels, fraisConstitution, amenagementBureaux, materielTransport.
</output_format>`;

export const FINANCE_AUTOFILL_FINANCING_PROMPT = `<objective>Produce a balanced funding plan covering the total project cost.</objective>
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
Target split: 30-50% equity, 30-50% debt, 10-20% other.
</output_format>`;

export const FINANCE_AUTOFILL_REVENUE_PARAMS_PROMPT = `<objective>Suggest the client receivables rate (% of revenue) for this sector.</objective>
<output_format>
JSON: {
  "revenueParams": { "clientReceivablesRatePct": <0-100> },
  "aiSuggestions": []
}
Benchmarks: B2C cash 0-5%, B2C subscription 5-15%, B2B 20-40%, marketplace 10-25%.
</output_format>`;

export const FINANCE_AUTOFILL_TAXES_PARAMS_PROMPT = `<objective>Suggest the tax parameters (premises size and regime).</objective>
<output_format>
JSON: {
  "taxesParams": { "locationSize": "petites|moyennes|grandes", "regimeType": "reel|forfait|auto" },
  "aiSuggestions": []
}
locationSize: petites (<50m²), moyennes (50-200m²), grandes (>200m²).
regimeType: "reel" when revenue exceeds 30M FCFA, otherwise "forfait".
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

export const FINANCE_CHAT_INTENT_PROMPT = `<objective>Read the user's financial intent and structure it.</objective>
<output_format>
Return VALID JSON ONLY:
{
  "isFinanceIntent": true|false,
  "kind": "read_summary" | "read_section" | "update_field" | "add_line" | "delete_line" | "none",
  "section": "products" | "salesObjectives" | "revenueParams" | "variableCharges" | "fixedCharges" | "taxesParams" | "investments" | "financing" | null,
  "target": string | null,
  "fieldPath": string | null,
  "value": any,
  "month": number | null,
  "year": number | null,
  "confirmationSentence": "a confirmation sentence, IN FRENCH, asking the user to validate",
  "summaryText": "a summary, IN FRENCH, when kind=read_*"
}
</output_format>

<examples>
The user writes in French, so the example utterances below are French.
- "Change le prix de mon produit principal à 25 000 FCFA" -> kind="update_field", section="products", target="produit principal", value=25000
- "Mon loyer mensuel est de 200 000 FCFA" -> kind="update_field", section="fixedCharges", target="loyer", value=200000
- "Ajoute un investissement : achat matériel pro pour 800 000 FCFA en mois 1" -> kind="add_line", section="investments", target="matériel pro", value=800000, month=1
- "Montre mes charges fixes" -> kind="read_section", section="fixedCharges"
- "Quel temps fait-il ?" -> isFinanceIntent=false, kind="none"
</examples>
`;
