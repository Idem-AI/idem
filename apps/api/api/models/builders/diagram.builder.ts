import { DiagramModel } from "../diagram.model";
import { v4 as uuidv4 } from "uuid";

/**
 * Builder for DiagramModel
 */
export class DiagramBuilder {
  /**
   * Creates an empty DiagramModel with all required properties
   */
  static createEmpty(): DiagramModel {
    return {
      sections: [],
    };
  }

  /**
   * Creates a partial DiagramModel with specified properties
   */
  static createPartial(data: Partial<DiagramModel>): DiagramModel {
    return { ...this.createEmpty(), ...data };
  }
}
