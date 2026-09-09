/**
 * Contrôle de MISE EN PAGE MESURÉE — `npm run check:fit`.
 *
 * ── CE QUE CE HARNAIS AJOUTE À `check:render` ───────────────────────────────
 *
 * `check:render` vérifie ce qui se lit dans le HTML : le balisage est
 * équilibré, la palette est celle de la charte, les contrastes sont atteints.
 * Aucune de ces assertions ne peut voir un chiffre-clé qui déborde sur son
 * voisin, un titre qui sort de la page ou une diapositive à moitié vide — ce
 * sont des faits de RENDU, et il faut un moteur de rendu pour les constater.
 *
 * Ici, il y en a un : le même Chrome que celui qui produit les PDF. Les pages
 * sont montées dans la structure EXACTE du pipeline (`.section` à hauteur fixe,
 * `.data-content` à 100 %), puis mesurées.
 *
 * ── LES TROIS DÉFAUTS MESURÉS ───────────────────────────────────────────────
 *
 *  1. DÉBORDEMENT LATÉRAL. Aucun élément ne sort de la page. C'est le
 *     défaut qui faisait se chevaucher « 2,3 Md FCFA » et « +18 %/an » : le
 *     chiffre était composé pour une pleine page et posé dans une colonne des
 *     7/12.
 *
 *  2. CHEVAUCHEMENT. Deux éléments frères dans le flux ne se superposent
 *     jamais. Un décor en `position: absolute` est exclu — il est FAIT pour
 *     passer derrière.
 *
 *  3. REMPLISSAGE. Une page à hauteur fixe occupe entre 45 % et 100 % de sa
 *     hauteur. En dessous, elle ne respire pas : elle paraît inachevée, ce
 *     qui était le reproche le plus constant fait aux chartes produites.
 *
 * Ces trois faits ne dépendent d'aucun modèle et ne demandent l'avis de
 * personne : ils se constatent. C'est précisément ce qu'il faut pour garantir
 * un rendu sans relecture.
 *
 *   npx ts-node --transpile-only api/scripts/checkPageFit.ts
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

import puppeteer from 'puppeteer';

import { buildDocumentSeed, buildSectionSeed } from '../services/design/designSeed';
import { buildDocumentDesignSystem } from '../services/design/documentDesignSystem';
import { SectionContent } from '../services/design/sectionContent';
import {
  IMPLEMENTED_ARCHETYPES,
  LANDSCAPE_SLIDE,
  PORTRAIT_A4,
  renderSection,
} from '../services/design/sectionRenderer';

/** Marge de tolérance, en px. Un pixel d'arrondi n'est pas un débordement. */
const TOLERANCE = 1.5;

/** Remplissage minimal d'une page à hauteur fixe. */
const MIN_FILL = 0.45;

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const CHARTER = {
  colors: {
    colors: {
      primary: '#1F4E5F',
      secondary: '#4A5A60',
      accent: '#C6553D',
      background: '#FAF7F2',
      text: '#0F1B1F',
    },
  },
  typography: { primaryFont: 'Fraunces', secondaryFont: 'Public Sans' },
};

/**
 * Contenu d'épreuve : les valeurs y sont volontairement LONGUES.
 *
 * Un harnais nourri de contenu commode ne mesure rien. « 2,3 Md FCFA » est
 * exactement la valeur qui débordait en production, et les libellés de
 * longueurs inégales sont ce qui désalignait les rangées.
 */
const CONTENT: SectionContent = {
  kicker: 'Marché',
  title: 'Le café de spécialité arrive au Cameroun',
  lede: "La torréfaction locale capte pour la première fois la valeur qui partait à l'export.",
  blocks: [
    {
      kind: 'metrics',
      items: [
        { value: '2,3 Md FCFA', label: 'marché urbain du café torréfié', note: '2025' },
        { value: '+18 %/an', label: 'croissance du segment premium', note: '2022-2025' },
        { value: '4 200 t', label: 'volume torréfié localement', note: '2025' },
      ],
    },
    {
      kind: 'prose',
      paragraphs: [
        "Douala et Yaoundé concentrent 71 % de la consommation de café torréfié du pays, pour 22 % de la population. Trois torréfacteurs y opèrent à l'échelle industrielle, aucun sur le segment de spécialité.",
      ],
    },
  ],
};

/** Page de nuancier : celle où le désalignement se voyait le plus. */
const SWATCH_PAGE: SectionContent = {
  kicker: 'Couleur',
  title: 'La palette',
  lede: 'Cinq valeurs, un rôle chacune.',
  blocks: [
    {
      kind: 'swatches',
      items: [
        { hex: '#1F4E5F', name: 'Primaire', role: 'Identité, titres, aplats' },
        { hex: '#4A5A60', name: 'Secondaire', role: 'Support, zones calmes' },
        { hex: '#C6553D', name: 'Accent', role: 'Chiffres, appels, filets' },
        { hex: '#FAF7F2', name: 'Fond', role: 'Surface de page' },
        { hex: '#0F1B1F', name: 'Encre', role: 'Texte courant' },
      ],
    },
  ],
};

/** Page à quatre cartes : celle qui produisait une rangée orpheline. */
const CARDS_PAGE: SectionContent = {
  kicker: 'Usage',
  title: 'Quatre règles',
  blocks: [
    {
      kind: 'cards',
      items: [
        { title: 'Zone de respiration', body: "La hauteur du signe, de chaque côté." },
        { title: 'Taille minimale', body: '18 mm de large en impression, 96 px à l\'écran.' },
        { title: 'Fonds admis', body: 'Le blanc, l\'encre de la charte, une photographie calme.' },
        { title: 'Interdits', body: 'Aucune ombre portée, aucune rotation, aucun contour.' },
      ],
    },
  ],
};

interface PageProbe {
  name: string;
  html: string;
  /** Le format de CETTE page. Une charte peut mêler 16:9 et A4 portrait. */
  width: string;
  height: string;
}

function buildPages(): PageProbe[] {
  const seed = buildDocumentSeed('editorial', 'fit:demo');
  const ds = buildDocumentDesignSystem(CHARTER, { styleId: 'editorial' } as never, seed);

  const pages: PageProbe[] = [];

  // Les douze archétypes en 16:9 — le format de la charte et du deck.
  for (const archetype of IMPLEMENTED_ARCHETYPES) {
    const base = buildSectionSeed('editorial', 'fit:demo', `A-${archetype}`, new Set());
    pages.push({
      name: `16:9 archétype ${archetype}`,
      width: LANDSCAPE_SLIDE.width,
      height: LANDSCAPE_SLIDE.minHeight,
      html: renderSection(CONTENT, ds, { ...base, archetype }, {
        page: LANDSCAPE_SLIDE,
        multiPage: false,
        brandName: 'Café des Hauts',
        index: 3,
      }),
    });
  }

  // Les pages spécimens, sur trois archétypes différents : ce sont elles que
  // la charte livre, et leur composition ne doit dépendre d'aucun tirage.
  for (const [index, archetype] of ['A', 'D', 'G'].entries()) {
    const base = buildSectionSeed('editorial', 'fit:demo', `S-${archetype}`, new Set());
    pages.push({
      name: `16:9 nuancier (archétype ${archetype})`,
      width: LANDSCAPE_SLIDE.width,
      height: LANDSCAPE_SLIDE.minHeight,
      html: renderSection(SWATCH_PAGE, ds, { ...base, archetype }, {
        page: LANDSCAPE_SLIDE,
        multiPage: false,
        brandName: 'Café des Hauts',
        index: index + 1,
      }),
    });
    pages.push({
      name: `16:9 cartes (archétype ${archetype})`,
      width: LANDSCAPE_SLIDE.width,
      height: LANDSCAPE_SLIDE.minHeight,
      html: renderSection(CARDS_PAGE, ds, { ...base, archetype }, {
        page: LANDSCAPE_SLIDE,
        multiPage: false,
        brandName: 'Café des Hauts',
        index: index + 1,
      }),
    });
  }

  // Une charte peut aussi être demandée en A4 portrait : le format est rogné
  // de la même façon, il se mesure de la même façon.
  const portraitSeed = buildSectionSeed('editorial', 'fit:demo', 'portrait', new Set());
  pages.push({
    name: 'A4 portrait rogné (nuancier)',
    width: PORTRAIT_A4.width,
    height: PORTRAIT_A4.minHeight,
    html: renderSection(SWATCH_PAGE, ds, portraitSeed, {
      page: PORTRAIT_A4,
      multiPage: false,
      brandName: 'Café des Hauts',
      index: 1,
    }),
  });

  return pages;
}

/**
 * Monte les pages dans la structure EXACTE du pipeline PDF.
 *
 * Mesurer une structure approchante ne prouverait rien : c'est le
 * `.section { height; overflow: hidden }` et le `.data-content { height:100% }`
 * qui font qu'une page rogne, et donc eux qu'il faut reproduire.
 */
function buildDocument(pages: PageProbe[]): string {
  const sections = pages
    .map(
      (page) =>
        `<div class="section" data-section-name="${page.name.replace(/"/g, '&quot;')}" style="width:${page.width};height:${page.height};min-height:${page.height};max-height:${page.height}"><div class="data-content">${page.html}</div></div>`
    )
    .join('\n');

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .section { display: block; overflow: hidden; position: relative; }
  .data-content { width: 100%; height: 100%; }
</style></head><body>${sections}</body></html>`;
}

interface Measurement {
  name: string;
  /** Débordement latéral maximal constaté, en px. */
  overflowRight: number;
  /** Débordement vertical du contenu par rapport à la page, en px. */
  overflowBottom: number;
  /** Part de la hauteur de page réellement occupée. */
  fill: number;
  /** Paires d'éléments frères qui se superposent. */
  overlaps: string[];
}

/**
 * Ce qui est mesuré DANS le navigateur.
 *
 * Écrit en une seule fonction sérialisable : elle est évaluée dans la page, où
 * rien du contexte Node n'existe.
 */
function measureInPage(tolerance: number): Measurement[] {
  const results: Measurement[] = [];
  const sections = Array.from(document.querySelectorAll('.section'));

  for (const section of sections) {
    const name = section.getAttribute('data-section-name') || '?';
    const host = section.querySelector('.data-content') || section;
    // Les `<link>` de police précèdent la racine : ils sont dans le DOM et ne
    // peignent rien. Prendre le premier enfant sans les écarter, c'est mesurer
    // une balise de chargement au lieu de la page — le défaut exact que le
    // runtime de pagination portait.
    const root = Array.from(host.children).find(
      (child) => !['LINK', 'SCRIPT', 'STYLE', 'META'].includes(child.tagName)
    ) as HTMLElement | undefined;
    if (!root) continue;

    const pageBox = section.getBoundingClientRect();
    const rootStyle = getComputedStyle(root);
    const padLeft = Number.parseFloat(rootStyle.paddingLeft) || 0;
    const padRight = Number.parseFloat(rootStyle.paddingRight) || 0;
    const padTop = Number.parseFloat(rootStyle.paddingTop) || 0;
    const padBottom = Number.parseFloat(rootStyle.paddingBottom) || 0;

    // La borne est le bord de PAGE, non la zone utile : plusieurs archétypes
    // font délibérément saigner un bandeau jusqu'au bord — c'est une décision
    // de composition. Sortir de la PAGE, en revanche, n'est jamais voulu :
    // l'élément y est simplement rogné.
    void padLeft;
    const contentRight = pageBox.right;
    const contentTop = pageBox.top + padTop;
    const contentBottom = pageBox.bottom - padBottom;
    void padRight;

    let overflowRight = 0;
    const overlaps: string[] = [];
    let inkTop = Number.POSITIVE_INFINITY;
    let inkBottom = Number.NEGATIVE_INFINITY;

    const describe = (el: Element): string => {
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
      return text || el.tagName.toLowerCase();
    };

    const all = Array.from(root.querySelectorAll('*'));
    for (const el of all) {
      const style = getComputedStyle(el);
      // Un décor est FAIT pour passer derrière et pour déborder : l'archétype
      // « J » encadre la page, le « F » glisse un panneau sous le titre.
      if (style.position === 'absolute' || style.position === 'fixed') continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;

      overflowRight = Math.max(overflowRight, box.right - contentRight);

      // L'encre réellement posée : ce qui borne le remplissage de la page.
      if (el.textContent && el.textContent.trim()) {
        inkTop = Math.min(inkTop, box.top);
        inkBottom = Math.max(inkBottom, box.bottom);
      }
    }

    // ── CHEVAUCHEMENT ENTRE FRÈRES ─────────────────────────────────────────
    // Comparé entre enfants d'un MÊME parent seulement : un enfant recouvre
    // toujours son parent, ce qui n'est pas un défaut.
    const containers = [root, ...all] as Element[];
    for (const parent of containers) {
      const style = getComputedStyle(parent);
      if (style.position === 'absolute' || style.position === 'fixed') continue;
      const kids = Array.from(parent.children).filter((kid) => {
        const kidStyle = getComputedStyle(kid);
        if (kidStyle.position === 'absolute' || kidStyle.position === 'fixed') return false;
        const box = kid.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      });

      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          const horizontal = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const vertical = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (horizontal > tolerance && vertical > tolerance) {
            overlaps.push(`« ${describe(kids[i])} » ∩ « ${describe(kids[j])} »`);
          }
        }
      }
    }

    const pageHeight = contentBottom - contentTop;
    const inked = Number.isFinite(inkTop) && Number.isFinite(inkBottom) ? inkBottom - inkTop : 0;

    results.push({
      name,
      overflowRight: Math.round(overflowRight * 10) / 10,
      overflowBottom: Math.round((inkBottom - contentBottom) * 10) / 10,
      fill: Math.round((inked / pageHeight) * 100) / 100,
      overlaps: overlaps.slice(0, 3),
    });
  }

  return results;
}

async function main(): Promise<void> {
  const pages = buildPages();
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    const document_ = buildDocument(pages);
    await page.setContent(document_, { waitUntil: 'load' });

    // Le document MESURÉ est aussi écrit sur disque. Une assertion dit qu'une
    // page déborde ; elle ne dit pas à quoi la page ressemble. Les deux sont
    // nécessaires, et il faut que ce soit le MÊME document — un aperçu
    // reconstruit à côté finirait par diverger de ce qui est vérifié.
    const target = resolve(__dirname, '../../logs/fit-preview.html');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, document_, 'utf-8');
    console.log(`Aperçu des pages mesurées : ${target}`);
    // Les polices de la charte viennent de Google Fonts : une page mesurée
    // avant leur arrivée est mesurée dans la mauvaise police, donc à la
    // mauvaise largeur.
    await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);

    const measurements = (await page.evaluate(measureInPage, TOLERANCE)) as Measurement[];

    console.log('\nDébordement latéral — aucun élément ne sort de la page');
    for (const m of measurements) {
      check(
        m.name,
        m.overflowRight <= TOLERANCE,
        m.overflowRight > TOLERANCE ? `dépasse de ${m.overflowRight} px à droite` : ''
      );
    }

    console.log('\nChevauchement — deux frères ne se superposent jamais');
    for (const m of measurements) {
      check(m.name, m.overlaps.length === 0, m.overlaps.join(' · '));
    }

    console.log(`\nRemplissage — une page occupe au moins ${Math.round(MIN_FILL * 100)} % de sa hauteur`);
    for (const m of measurements) {
      check(
        m.name,
        m.fill >= MIN_FILL,
        m.fill < MIN_FILL ? `${Math.round(m.fill * 100)} % seulement` : ''
      );
    }

    console.log('\nDébordement vertical — le contenu tient dans la page');
    for (const m of measurements) {
      check(
        m.name,
        m.overflowBottom <= TOLERANCE,
        m.overflowBottom > TOLERANCE ? `dépasse de ${m.overflowBottom} px en bas` : ''
      );
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\nMise en page : ${failures} vérification(s) en échec.`);
    process.exit(1);
  }
  console.log('\nMise en page : toutes les vérifications passent.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
