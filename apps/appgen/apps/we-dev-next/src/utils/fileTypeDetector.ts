export enum TypeEnum {
  MiniProgram = 'miniProgram',
  Other = 'other',
}

export function determineFileType(filesPath: string[]): TypeEnum {
  if (filesPath.includes('app.json')) {
    return TypeEnum.MiniProgram;
  }
  return TypeEnum.Other;
}
