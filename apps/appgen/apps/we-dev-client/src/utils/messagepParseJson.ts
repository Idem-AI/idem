interface ParsedMessage {
  content: string;
  files?: Record<string, string>;
}

// Pre-compiled regular expressions
const BOLT_ACTION_REGEX =
  /<boltAction type="file" filePath="([^"]+)">([\s\S]*?)<\/boltAction>/g;

export function parseMessage(content: string): ParsedMessage {
  try {
    const files: Record<string, string> = {};
    let boltMatch;

    BOLT_ACTION_REGEX.lastIndex = 0;

    while ((boltMatch = BOLT_ACTION_REGEX.exec(content)) !== null) {
      const [_, filePath, fileContent] = boltMatch;
      if (fileContent) {
        files[filePath] = fileContent.trim();
      }
    }

    const fileKeys = Object.keys(files);
    return {
      content: `${JSON.stringify(fileKeys)}`,
      files,
    };
  } catch (error) {
    console.error("Error parsing message:", error);
    return { content };
  }
}
