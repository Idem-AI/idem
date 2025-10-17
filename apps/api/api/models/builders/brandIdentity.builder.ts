import { BrandIdentityModel } from "../brand-identity.model";
import { ColorBuilder } from "./color.builder";
import { LogoBuilder } from "./logo.builder";
import { TypographyBuilder } from "./typography.builder";

/**
 * Builder for BrandIdentityModel
 */
export class BrandIdentityBuilder {
  /**
   * Creates an empty BrandIdentityModel with all required properties
   */
  static createEmpty(): BrandIdentityModel {
    return {
      logo: LogoBuilder.createEmpty(),
      generatedLogos: [],
      colors: ColorBuilder.createEmpty(),
      generatedColors: [],
      typography: TypographyBuilder.createEmpty(),
      generatedTypography: [],
      sections: [],
    };
  }

  /**
   * Creates a partial BrandIdentityModel with specified properties
   */
  static createPartial(data: Partial<BrandIdentityModel>): BrandIdentityModel {
    return { ...this.createEmpty(), ...data };
  }
}
