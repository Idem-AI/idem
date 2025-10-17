import { SectionModel } from "./section.model";

export interface BusinessPlanModel {
  id?: string;
  projectId?: string;
  sections: SectionModel[];
  createdAt?: Date;
  updatedAt?: Date;
  pdfBlob?: Blob; // Optional PDF blob for optimized loading
}
