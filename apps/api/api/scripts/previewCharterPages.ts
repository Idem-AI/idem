/**
 * Aperçu des pages de charte COMPOSÉES par le code.
 *
 * Rend, avec une marque et une direction artistique de test : les quatre pages
 * de direction artistique, la page du logo expliqué, et les deux pages sociales
 * (mockups rendus par le vrai service, visuel de secours). Chaque page est
 * photographiée au format de la charte et écrite dans le dossier temporaire.
 *
 *   npx ts-node --transpile-only api/scripts/previewCharterPages.ts
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
import { ArtDirectionModel } from '../models/art-direction.model';
import { buildDocumentDesignSystem } from '../services/design/documentDesignSystem';
import { buildDocumentSeed, buildSectionSeed } from '../services/design/designSeed';
import { LANDSCAPE_SLIDE, renderSection } from '../services/design/sectionRenderer';
import { buildComposedCharterPages, wideSeed } from '../services/BandIdentity/charterComposedPages';
import { SocialBrandKit } from '../services/BandIdentity/socialMockups/socialMockup.service';

const svg = (markup: string) => `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;
const LOGO_DARK_INK = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100"><rect x="10" y="10" width="44" height="60" fill="#1A2A4F"/><rect x="34" y="52" width="20" height="36" fill="#1A2A4F"/><text x="76" y="68" font-family="sans-serif" font-size="52" font-weight="700" fill="#1A2A4F">Light</text></svg>');
const LOGO_LIGHT_INK = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100"><rect x="10" y="10" width="44" height="60" fill="#7F9CE5"/><rect x="34" y="52" width="20" height="36" fill="#7F9CE5"/><text x="76" y="68" font-family="sans-serif" font-size="52" font-weight="700" fill="#fff">Light</text></svg>');
const ICON_LIGHT = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="22" y="10" width="44" height="60" fill="#fff"/><rect x="46" y="52" width="20" height="38" fill="#fff"/></svg>');

const AD: ArtDirectionModel = {
  styleId: 'swiss',
  styleName: 'Design suisse',
  tagline: "La grille comme moteur d'action et de transformation.",
  rationale:
    "Light accompagne des personnes qui veulent reprendre la main sur leur trajectoire. La rigueur d'une grille dit la méthode, l'or mat dit la valeur de chaque étape franchie.",
  keywords: ['grille modulaire', 'bleu nuit profond', 'or mat', 'escalier ascendant', 'espace blanc', 'ligne fine'],
  layout: {
    grid: 'Douze colonnes, gouttières constantes, tout aligné sur la gauche.',
    density: 'airy',
    whitespace: 'Au moins un quart de chaque page reste vide, en haut ou à droite.',
    signatureMove: "Un aplat bleu nuit qui déborde du cadre en escalier ascendant.",
  },
  color: {
    distribution: '60 / 30 / 10',
    application: 'Le bleu nuit porte les aplats et les titres, l’or souligne un chiffre ou un appel.',
    contrast: 'Franc : encre profonde sur fond clair, jamais deux tons moyens voisins.',
  },
  typography: {
    scaleContrast: 'Rapport de 1,5 entre deux niveaux, trois niveaux par page au plus.',
    caseAndTracking: 'Titres en capitales espacées, texte courant en bas de casse.',
    treatment: 'Aucun effet : ni ombre, ni contour, ni dégradé.',
  },
  imagery: {
    medium: 'photography',
    subjects: 'Des personnes en mouvement, en lumière naturelle, dans leur quotidien.',
    treatment: 'Désaturation légère, ombres bleutées, grain fin.',
    lighting: 'Lumière naturelle latérale, contrastes doux.',
    framing: 'Cadrages serrés, sujet décentré sur le tiers gauche.',
  },
  graphicDevices: ['filet fin de 1 px', 'escalier ascendant', 'aplats bleu nuit'],
  dos: [
    'Aligner chaque élément sur la grille de douze colonnes.',
    "Réserver l'or à un seul élément par page.",
    'Laisser un quart de la page vide.',
  ],
  donts: [
    'Poser une ombre portée ou un dégradé.',
    'Centrer un bloc de texte courant.',
    'Utiliser plus de deux familles typographiques.',
  ],
  imagePromptModifier: '',
};

async function main() {
  const out = path.join(os.tmpdir(), 'idem-charter-preview');
  fs.mkdirSync(out, { recursive: true });

  const docSeed = buildDocumentSeed('swiss', 'preview:charter');
  const ds = buildDocumentDesignSystem(
    {
      colors: { colors: { primary: '#1A2A4F', secondary: '#F4F6FA', accent: '#C79100', background: '#F8F9FB', text: '#0B1220' } },
      typography: { primaryFont: 'Syne', secondaryFont: 'Figtree' },
    } as never,
    AD,
    docSeed
  );
  const render = { logoUrl: LOGO_DARK_INK, brandName: 'Light', page: LANDSCAPE_SLIDE, multiPage: false };

  const kit: SocialBrandKit = {
    projectKey: 'preview',
    brandName: 'Light',
    handle: 'light',
    category: 'Développement personnel',
    promise: "Il n'est jamais trop tard pour briller",
    bio: 'Accompagnement en développement personnel, étape par étape, au Cameroun.',
    posts: [
      { title: 'Je fais face', hook: 'La première étape, celle où tout commence.', description: 'Un parcours en cinq étapes pour reprendre la main.', hashtags: ['developpementpersonnel', 'cameroun'] },
      { title: 'Je regarde le chemin parcouru', hook: 'Chaque étape franchie compte.', description: 'Mesurer le chemin parcouru pour tenir la suivante.', hashtags: ['motivation'] },
    ],
    audience: 'mixed',
    videoLed: false,
    ds,
    logos: { lightGround: LOGO_DARK_INK, darkGround: LOGO_LIGHT_INK, iconDarkGround: ICON_LIGHT },
  };

  const pages = buildComposedCharterPages({
    project: { name: 'Light', description: "Il n'est jamais trop tard pour briller." } as never,
    artDirection: AD,
    designSystem: ds,
    render,
    logos: { lightGround: LOGO_DARK_INK, darkGround: LOGO_LIGHT_INK },
    imageryUrl: async () => null,
    socialKit: async () => kit,
    renderPostVisual: async () => null,
    uploadMockup: async (image, name, contentType) => `data:${contentType};base64,${image.toString('base64')}`,
  });

  const used = new Set<string>();
  const html: Record<string, string> = {};
  let index = 1;
  // `PREVIEW_ARCHETYPES=B,G,O` rend chaque page sous chacune de ces structures :
  // la graine n'en tire qu'une par page, et un débordement propre à une autre
  // structure passerait inaperçu. `PREVIEW_PAGES` restreint aux pages nommées.
  const list = (value?: string) => (value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);
  const archetypes = list(process.env.PREVIEW_ARCHETYPES);
  const only = list(process.env.PREVIEW_PAGES);
  for (const name of Object.keys(pages)) {
    if (only.length > 0 && !only.includes(name)) continue;
    const seed = wideSeed(buildSectionSeed('swiss', 'preview:charter', name, used), 'swiss');
    if (archetypes.length === 0) {
      html[name] = (await pages[name](seed, index++)) ?? '';
      continue;
    }
    for (const archetype of archetypes) {
      html[`${name} ${archetype}`] = (await pages[name]({ ...seed, archetype }, index++)) ?? '';
    }
  }
  html['Logo Principal'] = renderSection(
    {
      title: 'Le logo',
      lede: 'Un symbole en escalier et le nom composé en capitales douces.',
      blocks: [
        {
          kind: 'logoStory',
          url: LOGO_DARK_INK,
          label: 'Logo Light',
          background: 'light',
          points: [
            { label: 'Le symbole', text: "Un rectangle qui s'élève en marches : la progression, une étape après l'autre." },
            { label: 'La construction', text: 'Trois blocs orthogonaux alignés sur une grille, sans courbe ni diagonale.' },
            { label: 'Le nom', text: 'Composé en Syne, graisse moyenne, bas de casse, approche resserrée.' },
            { label: 'Les couleurs', text: 'Le bleu nuit porte le symbole et le nom, sur fond clair.' },
          ],
        },
      ],
    },
    ds,
    wideSeed(buildSectionSeed('swiss', 'preview:charter', 'Logo Principal', used), 'swiss'),
    { ...render, index: index++ }
  );

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1123, height: 632, deviceScaleFactor: 1.5 });
  for (const [name, body] of Object.entries(html)) {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${body}</body></html>`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Les polices distantes peuvent traîner : on les attend, sans bloquer l'aperçu.
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 6000))]));
    await new Promise((resolve) => setTimeout(resolve, 400));
    const overflow = await page.evaluate(() => {
      const root = document.body.querySelector('div[style*="overflow:hidden"]') as HTMLElement | null;
      return root ? root.scrollHeight - root.clientHeight : -1;
    });
    const file = path.join(out, `${name.replace(/[^A-Za-z0-9]+/g, '-')}.png`) as `${string}.png`;
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1123, height: 632 } });
    console.log(`${name} → ${file}  (débordement ${overflow} px)`);
  }
  await browser.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
