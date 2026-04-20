import { SectionModel } from './section.model';

export interface PitchDeckModel {
  id?: string;
  projectId?: string;
  sections: SectionModel[];
  generatedAt?: Date;
  pdfBlob?: Blob;
}
