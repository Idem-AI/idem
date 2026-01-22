interface ParsedMessage {
  content: string;
  files?: Record<string, string>;
}

// Pre-compiled regular expressions
const ARTIFACT_REGEX = /<boltArtifact[^>]*>([\s\S]*?)<\/boltArtifact>/;
const BOLT_ACTION_REGEX =
  /<boltAction type="file" filePath="([^"]+)">([\s\S]*?)<\/boltAction>/g;

export function parseMessage(content: string): ParsedMessage {
  // Quick return if content doesn't contain keywords
  if (!content.includes("<boltArtifact")) {
    return { content };
  }

  try {
    // Extract boltArtifact content
    const match = content.match(ARTIFACT_REGEX);
    if (!match) {
      return { content };
    }

    const artifactContent = match[1].trim();
    const files: Record<string, string> = {};

    // Use string replacement instead of regex matching to extract file content
    let boltMatch;
    let startIndex = 0;

    // Reset regex lastIndex
    BOLT_ACTION_REGEX.lastIndex = 0;

    while ((boltMatch = BOLT_ACTION_REGEX.exec(artifactContent)) !== null) {
      const [_, filePath, fileContent] = boltMatch;

      // Use Object.assign instead of spread operator
      if (fileContent) {
        files[filePath] = fileContent.trim();
      }

      startIndex = BOLT_ACTION_REGEX.lastIndex;
    }

    // Use template string instead of string concatenation
    const fileKeys = Object.keys(files);
    const newContent = content.replace(
      ARTIFACT_REGEX,
      `Modified directory${JSON.stringify(fileKeys)}`
    );

    return {
      content: newContent.trim(),
      files,
    };
  } catch (error) {
    console.error("Error parsing message:", error);
    return { content };
  }
}
