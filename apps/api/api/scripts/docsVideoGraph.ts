/**
 * `npm run docs:video-graph` — écrit docs/VIDEO_CAPABILITIES.md depuis le graphe
 * (video.capabilities.ts). La doc ne peut donc pas dériver du code : on la
 * régénère après toute modification d'un nœud.
 */
import fs from 'fs';
import path from 'path';
import { CAPABILITIES, CapKind, CapNode, CapWhen, EXCLUDED_LIBRARIES, KitContext, resolveKit } from '../services/Communication/video/video.capabilities';
import { analyzeLogo } from '../services/Communication/video/video.logo';
import { buildVideoTheme } from '../services/Communication/video/video.theme';
import { brandById } from './fixtures/motion-video/brands';

const KIND_TITLES: Partial<Record<CapKind, string>> = {
  library: 'Bibliothèques installées',
  addon: 'Addons du moteur (paquets chargés à la demande)',
  concept: 'Concepts narratifs (le modèle en choisit un, parmi les 5 que le graphe propose)',
  rhythm: 'Rythmes (le modèle en choisit un parmi 3 ; jamais celui des dernières vidéos)',
  camera: 'Caméras (une par vidéo)',
  entrance: 'Entrées des éléments (une famille par vidéo)',
  treatment: 'Mises en scène des plans (une par plan, jamais deux fois de suite)',
  accent: 'Grand moment (la scène est choisie par le modèle, l’effet par la direction)',
  logo: 'Animations du logo',
  background: 'Fonds',
  annotate: 'Annotations du mot mis en valeur',
  icons: "Bibliothèques d'icônes",
  brandmark: 'Logo pendant la vidéo',
  easing: 'Courbes',
  postfx: 'Effets 3D',
  media: 'Médias pilotés',
  technique: 'Techniques de texte (générées depuis les directions)',
  transition: 'Transitions (générées depuis les directions)',
};

const when = (w?: CapWhen): string => {
  if (!w) return '—';
  const parts: string[] = [];
  if (w.logoSvg) parts.push('logo SVG');
  if (w.logoMinShapes != null) parts.push(`≥ ${w.logoMinShapes} forme(s)`);
  if (w.logoMaxShapes != null) parts.push(`≤ ${w.logoMaxShapes} formes`);
  if (w.logoNoRaster) parts.push('sans image matricielle');
  if (w.logoNoPaint) parts.push('sans dégradé');
  if (w.logoIcon) parts.push('symbole en image');
  if (w.minQuality) parts.push(`qualité ≥ ${w.minQuality}`);
  if (w.scene3d) parts.push('scène 3D');
  if (w.scenes) parts.push(`scène ${w.scenes.join('/')}`);
  if (w.media) parts.push(`média ${w.media}`);
  if (w.formats) parts.push(`formats ${w.formats.join('/')}`);
  if (w.types) parts.push(`type ${w.types.join('/')}`);
  return parts.join(', ');
};

const suits = (n: CapNode): string => {
  const s = n.suits;
  if (!s) return '—';
  const fmt = (o?: Record<string, number | undefined>) =>
    Object.entries(o || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
  return [s.directions && `dir. ${fmt(s.directions)}`, s.types && `types ${fmt(s.types)}`, s.objectives && `obj. ${fmt(s.objectives)}`, s.arts && `DA ${fmt(s.arts)}`, s.sectors && `secteurs ${fmt(s.sectors)}`].filter(Boolean).join(' · ') || '—';
};

const esc = (t: string) => t.replace(/\|/g, '\\|');

function table(kind: CapKind): string {
  const nodes = CAPABILITIES.filter((n) => n.kind === kind);
  if (kind === 'technique' || kind === 'transition') {
    return `| Nœud | Directions |\n|---|---|\n${nodes.map((n) => `| \`${n.id}\` | ${Object.keys(n.suits?.directions || {}).join(', ')} |`).join('\n')}`;
  }
  const rows = nodes.map((n) => `| \`${n.id}\` | ${esc(n.label)} | ${esc(n.summary)} | ${(n.requires || []).map((r) => `\`${r}\``).join(' ') || '—'} | ${when(n.when)} | ${suits(n)} | ${n.cost} | ${n.determinism} | ${n.impl ? `\`${n.impl}\`` : n.packages ? n.packages.map((p) => `\`${p}\``).join(' ') : '—'} |`);
  return `| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |\n|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}`;
}

function mermaid(): string {
  const shown = CAPABILITIES.filter((n) => !['technique', 'transition', 'direction'].includes(n.kind) && n.requires?.length);
  const id = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_');
  const lines = ['```mermaid', 'graph LR'];
  const seen = new Set<string>();
  for (const n of shown) {
    for (const r of n.requires || []) {
      for (const x of [n.id, r]) {
        if (seen.has(x)) continue;
        seen.add(x);
        lines.push(`  ${id(x)}["${x}"]`);
      }
      lines.push(`  ${id(n.id)} --> ${id(r)}`);
    }
  }
  lines.push('```');
  return lines.join('\n');
}

function examples(): string {
  const cases: { title: string; brandId: string; over: Partial<KitContext> }[] = [
    { title: 'Wax & Co — promo, cinétique, DA maximaliste', brandId: 'wax', over: { type: 'promo', direction: 'kinetic', artStyleId: 'maximalism', objective: 'promotion' } },
    { title: 'Bissap Délices — produit, éditorial', brandId: 'bissap', over: { type: 'product', direction: 'editorial', objective: 'product' } },
    { title: 'Kofi Tech — logo, précision, premium', brandId: 'kofi', over: { type: 'logo', direction: 'precision', quality: 'premium', objective: 'announce' } },
    { title: 'Mama Kitchen (sans logo) — événement, collage', brandId: 'mama', over: { type: 'promo', direction: 'collage', objective: 'event' } },
  ];
  return cases
    .map(({ title, brandId, over }) => {
      const brand = brandById(brandId);
      const theme = buildVideoTheme(brand.branding, brand.name);
      const ctx: KitContext = {
        type: 'promo',
        objective: 'promotion',
        direction: 'editorial',
        quality: 'hd',
        format: 'story',
        durationSec: 15,
        logo: analyzeLogo(theme.logo.fullSvgMarkup, theme.logo.svgMarkup !== theme.logo.fullSvgMarkup ? theme.logo.svgMarkup : undefined),
        hasLogoIcon: !!theme.logo.icon,
        media: { images: 2, videos: 0, models: 0, lotties: 0, rive: 0 },
        scenes: [
          { key: 'hook-1', sceneId: 'hook', hasMedia: false, hasTitle: true },
          { key: 'benefits-2', sceneId: 'benefits', hasMedia: false, hasTitle: true },
          { key: 'stat-3', sceneId: 'stat', hasMedia: false, hasTitle: false },
          { key: 'cta-4', sceneId: 'cta', hasMedia: false, hasTitle: true },
          { key: 'logo-5', sceneId: 'logo', hasMedia: false, hasTitle: false, three: over.type === 'logo' },
        ],
        text: `${brand.description} ${brand.type}`,
        seed: 2026,
        ...over,
      };
      const kit = resolveKit(ctx);
      const trace = kit.trace
        .map((d) => `  - **${d.kind}** → \`${d.chosen}\` (score ${d.score.toFixed(2)} : ${d.why.join(', ') || 'base'})${d.rejected.length ? `\n    - écartés : ${d.rejected.slice(0, 6).map((r) => `\`${r.id}\` (${r.reason})`).join(', ')}` : ''}`)
        .join('\n');
      return `### ${title}\n\nKit : logo \`${kit.logo}\`, fond \`${kit.background}\` sur ${kit.backdropScenes.join(', ') || '—'}, annotation \`${kit.annotate}\`, icônes \`${kit.iconSet}\`, addons ${kit.addons.map((a) => `\`${a}\``).join(' ') || 'aucun'}.\n\n${trace}`;
    })
    .join('\n\n');
}

const out = `# Graphe de capacités du moteur vidéo

> Fichier généré par \`npm run docs:video-graph\` depuis \`api/services/Communication/video/video.capabilities.ts\`.
> Ne pas éditer à la main. Guide de l'environnement : [VIDEO_ENGINE.md](VIDEO_ENGINE.md).

Le graphe dit ce que la vidéo **peut** utiliser et **quand**. Le routeur (\`resolveKit\`) le parcourt avec le contexte du projet
(type, objectif, direction de motion, direction artistique, logo vectoriel analysé, médias, format, qualité, secteur, vidéos
précédentes) et rend un kit validé, les addons à charger et le vocabulaire court laissé au modèle.

Score d'un nœud possible = 1 + 1,5 × affinité de direction + type + objectif + DA + secteurs − 0,4 × coût (si coût ≥ 2)
− 1,5 s'il a servi dans les deux dernières vidéos du projet. Tirage déterministe (graine de la vidéo) parmi les nœuds à moins
de 0,75 du meilleur.

## Arêtes « exige »

${mermaid()}

${(Object.keys(KIND_TITLES) as CapKind[]).map((k) => `## ${KIND_TITLES[k]}\n\n${table(k)}`).join('\n\n')}

## Bibliothèques écartées

| Bibliothèque | Raison |
|---|---|
${EXCLUDED_LIBRARIES.map((e) => `| ${e.name} | ${esc(e.reason)} |`).join('\n')}

## Exemples de décisions (marques de test)

${examples()}
`;

const file = path.resolve(__dirname, '../../docs/VIDEO_CAPABILITIES.md');
fs.writeFileSync(file, out);
console.log(`✓ ${path.relative(process.cwd(), file)} (${CAPABILITIES.length} nœuds)`);
