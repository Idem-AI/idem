export function stripIndents(strings: TemplateStringsArray, ...values: any[]): string {
  let result = '';

  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += values[i];
    }
  }

  const lines = result.split('\n');
  const minIndent = lines
    .filter((line) => line.trim().length > 0)
    .reduce((min, line) => {
      const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
      return Math.min(min, indent);
    }, Infinity);

  if (minIndent === Infinity) return result.trim();

  return lines
    .map((line) => line.slice(minIndent))
    .join('\n')
    .trim();
}
