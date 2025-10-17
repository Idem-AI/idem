import { SectionModel } from "../section.model";
import { v4 as uuidv4 } from "uuid";

/**
 * Builder for SectionModel
 */
export class SectionBuilder {
  /**
   * Creates an empty SectionModel with all required properties
   */
  static createEmpty(): SectionModel {
    return {
      name: "",
      type: "",
      data: undefined,
      summary: "",
    };
  }

  /**
   * Creates a partial SectionModel with specified properties
   */
  static createPartial(data: Partial<SectionModel>): SectionModel {
    return { ...this.createEmpty(), ...data };
  }
}
