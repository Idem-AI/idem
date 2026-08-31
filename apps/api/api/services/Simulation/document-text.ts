/**
 * Extraction du texte d'un business plan importé.
 *
 * Trois formats, et trois seulement : PDF, DOCX et Markdown. Ce sont ceux dans
 * lesquels un entrepreneur détient réellement son plan ; accepter davantage
 * reviendrait à accepter des fichiers dont on ne sait rien tirer.
 *
 * L'extraction ne cherche pas à restituer la mise en forme : la suite du
 * traitement (`document-intake`) ne travaille que sur du texte. Un PDF scanné
 * ne rend rien — il est refusé plus loin, faute de texte, avec un message qui
 * le dit.
 */

import JSZip from 'jszip';

import logger from '../../config/logger';
import { UnusableDocumentError } from './document-intake';

export type DocumentFormat = 'pdf' | 'docx' | 'markdown';

/** Reconnaît le format d'après l'extension, puis le type déclaré. */
export function detectFormat(fileName: string, mimeType?: string): DocumentFormat | null {
  const lower = (fileName || '').toLowerCase();

  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';

  // Les navigateurs déclarent le Markdown de façon peu fiable ; le type ne
  // sert donc qu'à rattraper une extension absente.
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'text/markdown':
    case 'text/x-markdown':
      return 'markdown';
    default:
      return null;
  }
}

/**
 * Rend le texte du document, quel que soit son format.
 *
 * @throws UnusableDocumentError si le format est inconnu, ou si le fichier ne
 * livre aucun texte — un PDF d'images scannées, typiquement.
 */
export async function extractDocumentText(
  buffer: Buffer,
  fileName: string,
  mimeType?: string,
): Promise<string> {
  const format = detectFormat(fileName, mimeType);

  if (!format) {
    throw new UnusableDocumentError(
      'Format non pris en charge. Importez votre business plan en PDF, Word (.docx) ou Markdown (.md).',
    );
  }

  const text =
    format === 'pdf'
      ? await extractFromPdf(buffer, fileName)
      : format === 'docx'
        ? await extractFromDocx(buffer, fileName)
        : buffer.toString('utf8');

  if (!text.replace(/\s+/g, '').length) {
    throw new UnusableDocumentError(
      format === 'pdf'
        ? `« ${fileName} » ne contient aucun texte : c'est probablement un document scanné, fait d'images. Exportez-le depuis votre traitement de texte, ou envoyez la version Word ou Markdown.`
        : `« ${fileName} » ne contient aucun texte exploitable.`,
    );
  }

  return text;
}

// ---------------------------------------------------------------------------

/**
 * PDF — via `pdfjs-dist`, en build « legacy » : c'est celui qui fonctionne
 * sous Node, hors navigateur.
 */
async function extractFromPdf(buffer: Buffer, fileName: string): Promise<string> {
  // Import différé : la bibliothèque est lourde, et seule cette branche s'en
  // sert. Elle n'est chargée que lorsqu'un PDF arrive vraiment.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  try {
    const document = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      // Rien à afficher : ni polices système, ni exécution de script.
      useSystemFonts: false,
      isEvalSupported: false,
      disableFontFace: true,
    }).promise;

    const pages: string[] = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      pages.push(joinTextItems(content.items as { str?: string; hasEOL?: boolean }[]));
      page.cleanup();
    }

    await document.destroy();
    logger.info(`Extracted ${document.numPages} PDF pages from "${fileName}"`);
    return pages.join('\n\n');
  } catch (error: any) {
    logger.warn(`PDF extraction failed for "${fileName}": ${error?.message}`);
    throw new UnusableDocumentError(
      `« ${fileName} » n'a pas pu être lu. Le fichier est peut-être protégé par mot de passe ou endommagé.`,
    );
  }
}

/**
 * Les fragments d'une page PDF arrivent morceau par morceau, sans espaces
 * garantis : `hasEOL` marque les fins de ligne, le reste se recolle.
 */
function joinTextItems(items: { str?: string; hasEOL?: boolean }[]): string {
  let text = '';
  for (const item of items) {
    text += item.str ?? '';
    if (item.hasEOL) text += '\n';
    else if (item.str && !item.str.endsWith(' ')) text += ' ';
  }
  return text;
}

/**
 * DOCX — un fichier ZIP dont `word/document.xml` porte le contenu. Les balises
 * de mise en forme sautent, les fins de paragraphe et les sauts de ligne
 * deviennent des retours à la ligne.
 */
async function extractFromDocx(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const archive = await JSZip.loadAsync(buffer);
    const entry = archive.file('word/document.xml');
    if (!entry) {
      throw new Error('word/document.xml is missing');
    }

    const xml = await entry.async('string');
    const text = xml
      // Structure du document : paragraphes, sauts, cellules de tableau.
      .replace(/<w:p[ >]/g, '\n<w:p ')
      .replace(/<w:br\b[^>]*\/?>/g, '\n')
      .replace(/<\/w:tc>/g, '\t')
      .replace(/<\/w:tr>/g, '\n')
      // Le texte lui-même vit dans <w:t>, tout le reste est de la mise en forme.
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    logger.info(`Extracted ${text.length} characters from DOCX "${fileName}"`);
    return text;
  } catch (error: any) {
    logger.warn(`DOCX extraction failed for "${fileName}": ${error?.message}`);
    throw new UnusableDocumentError(
      `« ${fileName} » n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un document Word au format .docx.`,
    );
  }
}
