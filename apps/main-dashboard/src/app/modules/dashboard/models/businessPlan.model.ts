import { SectionModel } from './section.model';
import { BusinessPlanStructure } from './business-plan-structure.model';

/** Qualité de mise en page d'une section dans le dernier PDF généré. */
export interface SectionPdfQuality {
  sectionName: string;
  /** Ratio de remplissage le plus faible parmi les pages (0..1). */
  worstFill: number;
  pages: number;
}

/** Résumé retourné par GET /pdf-quality/:projectId. */
export interface BusinessPlanPdfQuality {
  generatedAt: Date;
  underFilledSections: SectionPdfQuality[];
}

export interface BusinessPlanModel {
  id?: string;
  projectId?: string;
  /** Nom donné par l'utilisateur. */
  name?: string | null;
  /** Structure retenue (dossier bancaire, plan investisseur, sur mesure…). */
  structure?: BusinessPlanStructure;
  sections: SectionModel[];
  createdAt?: Date;
  updatedAt?: Date;
  pdfBlob?: Blob; // Optional PDF blob for optimized loading
  pdfQuality?: BusinessPlanPdfQuality;
}
