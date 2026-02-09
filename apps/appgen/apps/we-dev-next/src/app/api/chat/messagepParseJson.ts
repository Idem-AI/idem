import { excludeFiles } from "./utils/fileProcessor";

interface ParsedMessage {
    content: string;
    files?: Record<string, string>;
  }
  
  export function parseMessage(content: string): ParsedMessage {
    // 匹配 boltArtifact 标签的正则表达式
    const artifactRegex = /<boltArtifact[^>]*>([\s\S]*?)<\/boltArtifact>/;
    
    // 如果内容中包含 boltArtifact
    if (artifactRegex.test(content)) {
      // 移除 boltArtifact 部分，替换为固定文本

      
      // 提取 boltArtifact 中的内容
      const match = content.match(artifactRegex);
      if (match) {
        const artifactContent = match[1].trim();
        
        // 解析文件内容
        const files: Record<string, string> = {};
        const boltActionRegex = /<boltAction type="file" filePath="([^"]+)">([\s\S]*?)<\/boltAction>/g;
        
        let boltMatch;
        while ((boltMatch = boltActionRegex.exec(artifactContent)) !== null) {
          const [_, filePath, fileContent] = boltMatch;
          if (!excludeFiles.includes(filePath)) {
            files[filePath] = fileContent.trim();
          }
        }
        
        const newContent = content.replace(artifactRegex, `已经修改好了的目录${JSON.stringify(Object.keys(files))}`);
        return {
          content: newContent.trim(),
          files
        };
      }
    }
    
    // 如果没有 boltArtifact，返回原始内容
    return {
      content
    };
  }