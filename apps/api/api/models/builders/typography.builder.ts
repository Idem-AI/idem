import { TypographyModel } from "../brand-identity.model";
import { v4 as uuidv4 } from "uuid";

/**
 * Builder for TypographyModel
 */
export class TypographyBuilder {
  
  /**
   * Creates an empty TypographyModel with all required properties
   */
  static createEmpty(): TypographyModel {
    return {
      id: uuidv4(),
      name: "",
      url: "",
      primaryFont: "",
      secondaryFont: ""
    };
  }

  /**
   * Creates a partial TypographyModel with specified properties
   */
  static createPartial(data: Partial<TypographyModel>): TypographyModel {
    return { ...this.createEmpty(), ...data };
  }
}
