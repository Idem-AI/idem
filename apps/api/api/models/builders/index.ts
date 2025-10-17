import { AnalysisResultBuilder } from "./analysisResult.builder";
import { ArchitectureBuilder } from "./architecture.builder";
import { BrandIdentityBuilder } from "./brandIdentity.builder";
import { BusinessPlanBuilder } from "./businessPlan.builder";
import { ColorBuilder } from "./color.builder";
import { LandingBuilder } from "./landing.builder";
import { LogoBuilder } from "./logo.builder";
import { ProjectBuilder } from "./project.builder";
import { SectionBuilder } from "./section.builder";
import { TypographyBuilder } from "./typography.builder";
import { UserBuilder } from "./user.builder";

// Central export file for all model builders
export { AnalysisResultBuilder };
export { ArchitectureBuilder };
export { BrandIdentityBuilder };
export { BusinessPlanBuilder };
export { ColorBuilder };
export { LandingBuilder };
export { LogoBuilder };
export { ProjectBuilder };
export { SectionBuilder };
export { TypographyBuilder };
export { UserBuilder };

/**
 * Convenience object for quick access to all builders
 */
export const Builders = {
  AnalysisResult: AnalysisResultBuilder,
  Architecture: ArchitectureBuilder,
  BrandIdentity: BrandIdentityBuilder,
  BusinessPlan: BusinessPlanBuilder,
  Color: ColorBuilder,
  Landing: LandingBuilder,
  Logo: LogoBuilder,
  Project: ProjectBuilder,
  Section: SectionBuilder,
  Typography: TypographyBuilder,
  User: UserBuilder,
};
