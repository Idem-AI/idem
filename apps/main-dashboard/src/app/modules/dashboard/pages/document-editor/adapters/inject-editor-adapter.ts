import { inject } from '@angular/core';
import { DocumentTypeAdapter, EditorDocumentType } from '../models/editor.types';
import { BrandingEditorAdapter } from './branding-editor.adapter';
import { BusinessCardEditorAdapter } from './business-card-editor.adapter';
import { BusinessPlanEditorAdapter } from './business-plan-editor.adapter';
import { FlyerEditorAdapter } from './flyer-editor.adapter';
import { LegalDocEditorAdapter } from './legal-doc-editor.adapter';
import { PitchDeckEditorAdapter } from './pitch-deck-editor.adapter';

/**
 * Adaptateur d'un type de document. À appeler dans un contexte d'injection
 * (initialiseur de champ, constructeur) : l'éditeur et l'aperçu le résolvent
 * de la même façon, donc lisent et rendent exactement les mêmes sections.
 */
export function injectEditorAdapter(type: EditorDocumentType | undefined): DocumentTypeAdapter {
  switch (type) {
    case 'pitch-deck':
      return inject(PitchDeckEditorAdapter);
    case 'branding':
      return inject(BrandingEditorAdapter);
    case 'business-card':
      return inject(BusinessCardEditorAdapter);
    case 'flyer':
      return inject(FlyerEditorAdapter);
    case 'legal-doc':
      return inject(LegalDocEditorAdapter);
    default:
      return inject(BusinessPlanEditorAdapter);
  }
}
