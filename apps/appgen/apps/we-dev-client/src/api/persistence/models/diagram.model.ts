import type { SectionModel } from './section.model';

export interface DiagramModel {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  sections: SectionModel[];
}
