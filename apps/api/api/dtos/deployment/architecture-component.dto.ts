export interface ArchitectureComponentDto {
  instanceId: string;
  type: string;
  configuration?: { [key: string]: any };
  dependencies?: string[];
}

export interface UpdateArchitectureComponentsDto {
  components: ArchitectureComponentDto[];
}
