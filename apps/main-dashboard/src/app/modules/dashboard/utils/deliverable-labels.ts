import { TranslateService } from '@ngx-translate/core';

/** Identifiant de la structure composée par l'utilisateur (`custom` côté API). */
export const CUSTOM_BUSINESS_PLAN_TEMPLATE_ID = 'custom';

/** Traduction, ou `null` quand la clé manque (`instant` rend alors la clé). */
function translated(translate: TranslateService, key: string): string | null {
  const value: unknown = translate.instant(key);
  return typeof value === 'string' && value !== key ? value : null;
}

/** Libellé du modèle d'un business plan (dossier bancaire, plan investisseur…). */
export function businessPlanVariantLabel(
  translate: TranslateService,
  templateId?: string | null,
): string {
  const custom =
    translated(translate, 'dashboard.deliverableList.businessPlan.customName') ?? 'Business plan';
  if (!templateId || templateId === CUSTOM_BUSINESS_PLAN_TEMPLATE_ID) return custom;
  return (
    translated(translate, `dashboard.businessPlanStructure.templates.${templateId}.name`) ?? custom
  );
}

/** Libellé du type d'un pitch deck (levée de fonds, banque, commercial…). */
export function pitchDeckTypeLabel(translate: TranslateService, typeId?: string | null): string {
  return (
    translated(translate, `dashboard.pitchDeckTypes.types.${typeId || 'investor'}.name`) ??
    'Pitch deck'
  );
}
