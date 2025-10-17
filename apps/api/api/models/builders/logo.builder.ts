import { LogoModel } from "../logo.model";
import { v4 as uuidv4 } from "uuid";

/**
 * Builder for LogoModel
 */
export class LogoBuilder {
  
  /**
   * Creates an empty LogoModel with all required properties
   */
  static createEmpty(): LogoModel {
    return {
      id: uuidv4(),
      name: "",
      svg: "",
      concept: "",
      colors: [],
      fonts: []
    };
  }

  /**
   * Creates a partial LogoModel with specified properties
   */
  static createPartial(data: Partial<LogoModel>): LogoModel {
    return { ...this.createEmpty(), ...data };
  }
}
