import { ColorModel } from "../brand-identity.model";
import { v4 as uuidv4 } from "uuid";

/**
 * Builder for ColorModel
 */
export class ColorBuilder {
  
  /**
   * Creates an empty ColorModel with all required properties
   */
  static createEmpty(): ColorModel {
    return {
      id: uuidv4(),
      name: "",
      url: "",
      colors: {
        primary: "#000000",
        secondary: "#666666",
        accent: "#0066cc",
        background: "#ffffff",
        text: "#333333"
      }
    };
  }

  /**
   * Creates a partial ColorModel with specified properties
   */
  static createPartial(data: Partial<ColorModel>): ColorModel {
    return { ...this.createEmpty(), ...data };
  }
}
