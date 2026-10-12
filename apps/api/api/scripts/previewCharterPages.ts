/**
 * Aperçu des pages de charte COMPOSÉES par le code.
 *
 * Rend, avec une marque et une direction artistique de test : les quatre pages
 * de direction artistique, la page du logo expliqué, et les deux pages sociales
 * (mockups rendus par le vrai service, visuel de secours). Chaque page est
 * composée et MESURÉE par le moteur graphique (@idem/graphic-engine), comme dans
 * la charte, puis photographiée et écrite dans le dossier temporaire.
 *
 *   npx ts-node --transpile-only api/scripts/previewCharterPages.ts
 *
 *   PREVIEW_PAGES="Art Direction,Social Profiles"  seulement ces pages ;
 *   PREVIEW_SEEDS=4                                 chaque page sous 4 graines (4 compositions) ;
 *   PREVIEW_FORMAT=page-a4                          toile A4 (défaut : 16:9).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { brandFromIdem, closeBrowser, createDocument, FormatId, SectionContent, systemSection } from '@idem/graphic-engine';
import { ArtDirectionModel } from '../models/art-direction.model';
import { buildComposedCharterPages } from '../services/BandIdentity/charterComposedPages';
import { SocialBrandKit } from '../services/BandIdentity/socialMockups/socialMockup.service';
import { PdfService } from '../services/pdf.service';

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

  const { brand, direction } = brandFromIdem({
    name: 'Light',
    branding: {
      colors: { colors: { primary: '#1A2A4F', secondary: '#F4F6FA', accent: '#C79100', background: '#F8F9FB', text: '#0B1220' } },
      typography: { primaryFont: 'Syne', secondaryFont: 'Figtree' },
      artDirection: { styleId: AD.styleId, keywords: AD.keywords },
    },
    logos: { primary: LOGO_DARK_INK, withTextLight: LOGO_DARK_INK, withTextDark: LOGO_LIGHT_INK, iconDark: ICON_LIGHT },
  });

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
    brand,
    direction,
    logos: { lightGround: LOGO_DARK_INK, darkGround: LOGO_LIGHT_INK, iconDarkGround: ICON_LIGHT },
  };

  const pages = buildComposedCharterPages({
    project: { name: 'Light', description: "Il n'est jamais trop tard pour briller." } as never,
    artDirection: AD,
    logos: { lightGround: LOGO_DARK_INK, darkGround: LOGO_LIGHT_INK },
    imageryUrl: async () => null,
    socialKit: async () => kit,
    renderPostVisual: async () => null,
    uploadMockup: async (image, _name, contentType) => `data:${contentType};base64,${image.toString('base64')}`,
  });

  // La page du logo expliqué : en charte, ses points viennent du rédacteur ; ici, écrits à la main.
  const logoPage: Record<string, () => Promise<SectionContent | null>> = {
    'Logo Principal': async () =>
      systemSection({
        id: 'logo-principal',
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
      }),
  };
  const all = { ...pages, ...logoPage };

  const list = (value?: string) => (value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);
  const only = list(process.env.PREVIEW_PAGES);
  const names = Object.keys(all).filter((name) => !only.length || only.includes(name));
  const seeds = Math.max(1, Number(process.env.PREVIEW_SEEDS) || 1);
  const format = (process.env.PREVIEW_FORMAT as FormatId | undefined) ?? 'slide-16x9';

  const contents: Array<{ name: string; content: SectionContent }> = [];
  for (const name of names) {
    const content = await all[name]();
    // Comme le service de la charte : chaque page prend l'identifiant de son étape (le plan lui réserve
    // sa composition, son rang et son folio).
    if (content) contents.push({ name, content: { ...content, id: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') } });
    else console.log(`${name} → omise (rien de vrai à y montrer)`);
  }

  for (let seed = 1; seed <= seeds; seed++) {
    // Un document de charte, comme le service l'ouvre : même plan et même mémoire de diversité pour ses pages.
    const doc = await createDocument({
      documentType: 'brand-charter',
      format,
      brand,
      direction,
      seed: `preview:charter:${seed}`,
      sections: contents.map(({ content }) => ({ id: content.id, role: content.role })),
      documentLabel: 'Charte graphique',
      locale: 'fr',
      png: true,
    });
    for (const [index, { name, content }] of contents.entries()) {
      const composed = await doc.composeSection(content, { index: index + 2, total: contents.length + 1 });
      const file = path.join(out, `${name.replace(/[^A-Za-z0-9]+/g, '-')}${seeds > 1 ? `-${seed}` : ''}.png`);
      if (composed.png) fs.writeFileSync(file, composed.png);
      const issues = composed.result.issues.map((issue) => `${issue.severity === 'blocking' ? '✗' : '·'} ${issue.code}${process.env.PREVIEW_VERBOSE ? ` (${issue.message})` : ''}`).join(' ');
      console.log(`${name} [${composed.spec.pattern.id}] → ${file}${issues ? `  (${issues})` : ''}`);
    }
  }
  // Les pages sociales passent par l'hôte IDEM du moteur : elles ont pris le Chromium PARTAGÉ du service
  // PDF, que `closeBrowser` du moteur ne ferme jamais — on ferme les deux.
  await closeBrowser();
  await PdfService.closeBrowser().catch(() => undefined);
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  await closeBrowser().catch(() => undefined);
  await PdfService.closeBrowser().catch(() => undefined);
  process.exit(1);
});
