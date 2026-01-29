import { excludeFiles } from './fileProcessor.js';

interface ParsedMessage {
  content: string;
  files?: Record<string, string>;
}

export function parseMessage(content: string): ParsedMessage {
  const artifactRegex = /<boltArtifact[^>]*>([\s\S]*?)<\/boltArtifact>/;

  if (artifactRegex.test(content)) {
    const match = content.match(artifactRegex);
    if (match) {
      const artifactContent = match[1].trim();

      const files: Record<string, string> = {};
      const boltActionRegex =
        /<boltAction type="file" filePath="([^"]+)">([\s\S]*?)<\/boltAction>/g;

      let boltMatch;
      while ((boltMatch = boltActionRegex.exec(artifactContent)) !== null) {
        const [_, filePath, fileContent] = boltMatch;
        if (!excludeFiles.includes(filePath)) {
          files[filePath] = fileContent.trim();
        }
      }

      const newContent = content.replace(
        artifactRegex,
        `已经修改好了的目录${JSON.stringify(Object.keys(files))}`
      );
      return {
        content: newContent.trim(),
        files,
      };
    }
  }

  return {
    content,
  };
}
