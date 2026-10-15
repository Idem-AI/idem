/**
 * Le flux d'une réponse du moteur de sites : le même format que celui d'un
 * modèle (artefact, actions de fichier, lignes d'état), que l'atelier applique
 * sans distinction.
 */

import type { Response } from 'express';
import { formatDataStreamPart } from 'ai';

/** Un signe de vie régulier : certains relais coupent un flux muet. */
const KEEPALIVE_MS = 12_000;

export class SiteStream {
  private keepalive?: NodeJS.Timeout;

  constructor(private readonly res: Response) {}

  open(model: string) {
    this.res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1',
      'x-idem-model': model,
    });
    this.keepalive = setInterval(() => this.res.write(formatDataStreamPart('data', [{ type: 'progress' }])), KEEPALIVE_MS);
  }

  text(chunk: string) {
    this.res.write(formatDataStreamPart('text', chunk));
  }

  file(path: string, content: string) {
    this.text(`<boltAction type="file" filePath="${path}">\n${content}</boltAction>\n`);
  }

  /** Une ligne d'état dans la conversation, sans effet sur le projet. */
  note(text: string) {
    this.text(`<boltAction type="note">${text.replace(/[<>]/g, '')}</boltAction>\n`);
  }

  command(type: 'shell' | 'start', command: string) {
    this.text(`<boltAction type="${type}">\n${command}\n</boltAction>\n`);
  }

  close(usage: { promptTokens: number; completionTokens: number }, error?: string) {
    if (this.keepalive) clearInterval(this.keepalive);
    if (error) this.res.write(formatDataStreamPart('error', error));
    this.res.write(formatDataStreamPart('finish_message', { finishReason: error ? 'error' : 'stop', usage }));
    this.res.end();
  }
}
