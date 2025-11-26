export interface EnvironmentVariableDto {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface UpdateEnvironmentVariablesDto {
  variables: EnvironmentVariableDto[];
}
