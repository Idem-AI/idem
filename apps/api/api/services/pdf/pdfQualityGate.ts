/**
 * Contrôle QUALITÉ du PDF imprimé — sans modèle, sans avis : mesuré.
 *
 * Le paginateur compose des pages ; ce module relit ce qui est réellement sorti
 * de Chrome. Chaque page est rastérisée à basse définition et l'on y mesure
 * l'encre :
 *
 *  · une page de FLUX sans aucune encre ni aucun caractère est une page
 *    BLANCHE. Elle ne porte rien : la retirer ne coûte rien au contenu. C'est la
 *    seule correction faite ici — le reste se corrige en amont, là où le
 *    contenu est connu (`flow-pagination.runtime`, options `compact`) ;
 *  · une page de flux dont une bande horizontale d'au moins `HOLE_MIN` de sa
 *    hauteur est vide porte un TROU. Il est signalé, avec sa section.
 *
 * Le contrôle ne fait jamais échouer un PDF : sans `canvas` (dépendance
 * optionnelle de pdfjs-dist), il se retire et le dit dans son rapport.
 */

/** Nature d'une page, telle que le paginateur l'a composée. */
export type ComposedPageKind = 'flow' | 'fixed' | 'signature' | 'unknown';

export interface ComposedPage {
  kind: ComposedPageKind;
  section: string;
}

export interface PdfPageInk {
  /** Numéro de page, à partir de 1. */
  page: number;
  /** Caractères de texte posés sur la page. */
  chars: number;
  /** Part des rangées de pixels qui portent de l'encre (0..1). */
  inkedRows: number;
  /** Plus grande bande horizontale vide, en part de la hauteur (0..1). */
  largestBlank: number;
  /** Début de cette bande, en part de la hauteur (0..1). */
  largestBlankAt: number;
}

export interface PdfQualityHole {
  page: number;
  section: string;
  /** Hauteur de la bande vide, en part de la page. */
  blank: number;
}

export interface PdfQualityGateReport {
  /** `false` quand la mesure n'a pas pu avoir lieu (voir `skipped`). */
  measured: boolean;
  skipped?: string;
  pagesBefore: number;
  pagesAfter: number;
  /** Pages retirées, numérotées comme dans le PDF AVANT retrait. */
  removedPages: number[];
  /** Trous restants, numérotés comme dans le PDF livré. */
  holes: PdfQualityHole[];
  /** Chrome a imprimé un autre nombre de pages que le paginateur n'en a composé. */
  pageCountMismatch: boolean;
  durationMs: number;
}

/** ~34 dpi : assez pour voir une ligne de texte, 1,5 s pour trente pages. */
const RASTER_SCALE = 0.35;

/** Écart au fond (somme des trois canaux) au-delà duquel un pixel est de l'encre. */
const INK_DELTA = 40;

/** Pixels encrés à partir desquels une rangée compte. */
const ROW_MIN_PIXELS = 2;

/** Part de rangées encrées sous laquelle une page SANS TEXTE est blanche. */
const BLANK_MAX_INKED_ROWS = 0.004;

/** Bande vide à partir de laquelle une page de flux porte un trou. */
export const HOLE_MIN = 0.35;

type CanvasModule = {
  createCanvas: (width: number, height: number) => {
    getContext: (kind: '2d') => any;
  };
};

function loadCanvas(): CanvasModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('canvas') as CanvasModule;
  } catch {
    return null;
  }
}

/**
 * Encre d'une page rastérisée.
 *
 * Le fond est la couleur la plus fréquente, quantifiée : une page de marque
 * n'est pas forcément blanche, et un fond crème n'est pas de l'encre.
 */
export function inkOf(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Pick<PdfPageInk, 'inkedRows' | 'largestBlank' | 'largestBlankAt'> {
  const keyAt = (i: number) => ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);

  const counts = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    const key = keyAt(i);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let groundKey = 0;
  let best = -1;
  for (const [key, count] of counts) {
    if (count > best) {
      best = count;
      groundKey = key;
    }
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (keyAt(i) !== groundKey) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  r /= n;
  g /= n;
  b /= n;

  let inked = 0;
  let run = 0;
  let largest = 0;
  let largestAt = 0;
  for (let y = 0; y < height; y++) {
    let pixels = 0;
    for (let x = 0; x < width && pixels < ROW_MIN_PIXELS; x++) {
      const i = (y * width + x) * 4;
      if (Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b) > INK_DELTA) {
        pixels++;
      }
    }
    if (pixels >= ROW_MIN_PIXELS) {
      inked++;
      run = 0;
    } else {
      run++;
      if (run > largest) {
        largest = run;
        largestAt = y - run + 1;
      }
    }
  }

  return {
    inkedRows: inked / height,
    largestBlank: largest / height,
    largestBlankAt: largestAt / height,
  };
}

/** Mesure chaque page d'un PDF. `null` si `canvas` n'est pas installé. */
export async function measurePdfPages(pdf: Uint8Array): Promise<PdfPageInk[] | null> {
  const canvasModule = loadCanvas();
  if (!canvasModule) return null;

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    // pdfjs détache le tampon qu'il reçoit : on lui en donne une copie.
    data: new Uint8Array(pdf),
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;

  try {
    const pages: PdfPageInk[] = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const viewport = page.getViewport({ scale: RASTER_SCALE });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      const context = canvasModule.createCanvas(width, height).getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      const text = await page.getTextContent();
      const chars = text.items.reduce(
        (sum, item) => sum + ('str' in item ? item.str.trim().length : 0),
        0
      );
      pages.push({
        page: index,
        chars,
        ...inkOf(context.getImageData(0, 0, width, height).data, width, height),
      });
      page.cleanup();
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

/** Plages d'impression Chrome (« 1-17, 19-21 ») qui omettent les pages données. */
export function pageRangesExcluding(total: number, exclude: readonly number[]): string {
  const ranges: string[] = [];
  let start = 0;
  for (let page = 1; page <= total + 1; page++) {
    const keep = page <= total && !exclude.includes(page);
    if (keep && start === 0) start = page;
    if (!keep && start !== 0) {
      ranges.push(start === page - 1 ? `${start}` : `${start}-${page - 1}`);
      start = 0;
    }
  }
  return ranges.join(', ');
}

/**
 * Mesure le PDF imprimé, retire les pages blanches, relève les trous.
 *
 * @param composed Pages composées par le paginateur, dans l'ordre du document.
 * @param reprint  Réimprime le MÊME document en ne gardant que ces plages.
 */
export async function runPdfQualityGate(
  pdf: Uint8Array,
  composed: readonly ComposedPage[],
  reprint: (pageRanges: string) => Promise<Uint8Array>
): Promise<PdfQualityGateReport> {
  const started = Date.now();
  let pages = await measurePdfPages(pdf);
  if (!pages) {
    return {
      measured: false,
      skipped: 'module canvas indisponible : PDF livré sans contrôle rastérisé',
      pagesBefore: 0,
      pagesAfter: 0,
      removedPages: [],
      holes: [],
      pageCountMismatch: false,
      durationMs: Date.now() - started,
    };
  }

  const pagesBefore = pages.length;
  // Si Chrome n'a pas imprimé les pages composées une pour une, la nature d'une
  // page n'est plus connue par son rang : on ne s'en sert plus.
  const pageCountMismatch = pages.length !== composed.length;
  const kindAt = (list: readonly ComposedPage[], index: number): ComposedPageKind =>
    pageCountMismatch ? 'unknown' : list[index]?.kind ?? 'unknown';

  // Une page n'est retirée que si elle ne porte RIEN. Jamais la dernière (la
  // signature), jamais une page composée pleine page.
  const removedPages = pages
    .filter((page, index) => {
      const kind = kindAt(composed, index);
      if (kind === 'fixed' || kind === 'signature') return false;
      if (page.page === pagesBefore) return false;
      return page.chars === 0 && page.inkedRows <= BLANK_MAX_INKED_ROWS;
    })
    .map((page) => page.page);

  let kept = composed;
  if (removedPages.length > 0 && removedPages.length < pagesBefore) {
    const reprinted = await reprint(pageRangesExcluding(pagesBefore, removedPages));
    pages = (await measurePdfPages(reprinted)) ?? pages;
    kept = composed.filter((_, index) => !removedPages.includes(index + 1));
  }

  // La dernière page de flux du document s'arrête où le texte s'arrête : ce
  // n'est pas un trou, c'est une fin.
  let lastFlow = pages.length - 2;
  if (!pageCountMismatch) {
    for (let index = kept.length - 1; index >= 0; index--) {
      if (kept[index].kind === 'flow') {
        lastFlow = index;
        break;
      }
    }
  }

  const holes = pages
    .filter((page, index) => {
      const kind = kindAt(kept, index);
      if (kind === 'fixed' || kind === 'signature') return false;
      if (index >= lastFlow) return false;
      return page.largestBlank >= HOLE_MIN;
    })
    .map((page) => ({
      page: page.page,
      section: pageCountMismatch ? '' : kept[page.page - 1]?.section ?? '',
      blank: Math.round(page.largestBlank * 100) / 100,
    }));

  return {
    measured: true,
    pagesBefore,
    pagesAfter: pages.length,
    removedPages,
    holes,
    pageCountMismatch,
    durationMs: Date.now() - started,
  };
}
