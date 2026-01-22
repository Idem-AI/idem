// Add function to parse context
export const parseFileFromContext = (filePath: string, content: string) => {
    const regex = new RegExp(
      `<boltAction[^>]*filePath="${filePath}"[^>]*>([\\s\\S]*?)<\\/boltAction>`
    );
    const match = content.match(regex);
    if (match) {
      return match[1].trim();
    }
    return null;
  };
  