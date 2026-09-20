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

      // L'artefact complet est remplacé par un accusé compact : les fichiers
      // sont désormais portés par le contexte projet, les réécrire dans
      // l'historique doublerait leur coût à chaque tour.
      //
      // Le libellé était en chinois (hérité du dépôt amont) : du bruit dans une
      // troisième langue, au milieu d'un prompt anglais, pour un produit
      // francophone. Un petit modèle y est nettement plus sensible qu'un grand.
      const newContent = content.replace(
        artifactRegex,
        `[files already written: ${JSON.stringify(Object.keys(files))}]`
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
