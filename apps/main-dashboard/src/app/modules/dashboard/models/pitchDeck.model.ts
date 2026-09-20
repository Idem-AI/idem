import { SectionModel } from './section.model';

export interface PitchDeckModel {
  id?: string;
  projectId?: string;
  /** Nom donné par l'utilisateur. */
  name?: string | null;
  /** Type de deck (levée de fonds, banque, commercial…). */
  type?: string;
  audience?: PitchDeckAudience;
  /** Slides attendues pour ce type, dans l'ordre du deck (renvoyées par l'API). */
  expectedSectionNames?: string[];
  sections: SectionModel[];
  generatedAt?: Date;
  createdAt?: string;
  updatedAt?: string;
  pdfBlob?: Blob;
}

/** Lecteur d'un deck — il décide des slides et du ton de chacune. */
export type PitchDeckAudience = 'investor' | 'bank' | 'customer' | 'partner' | 'jury';

/** Un type de deck proposé à la création (`GET /pitchDecks/types`). */
export interface PitchDeckType {
  id: string;
  audience: PitchDeckAudience;
  /** Durée de présentation typique, en minutes (ex. "10-15"). */
  speakingMinutes: string;
  isDefault: boolean;
  /** Slides, dans l'ordre du deck — noms canoniques, clés i18n. */
  slides: string[];
}

export interface PitchDeckTypeCatalog {
  defaultTypeId: string;
  types: PitchDeckType[];
}
