// utils.ts
type Primitive = string | number | boolean | symbol | null | undefined;

export function initEmptyObject<T>(defaults?: Partial<T>): T {
  const result: any = {};

  if (defaults) {
    Object.keys(defaults).forEach(key => {
      const val = (defaults as any)[key];
      result[key] = val !== undefined ? val : getDefaultValue(typeof val);
    });
  }

  return result as T;
}

function getDefaultValue(type: string): any {
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    default: return undefined;
  }
}