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
import { CAPABILITY_LABELS, capabilitiesForIntent, INTENTS, IntentId, PATTERNS, PatternDef } from '../services/Communication/video/video.patterns';
import { CREATIVE_WEIGHTS, EXPLORATION_BUDGET, NOVELTY_TARGET } from '../services/Communication/video/video.planner';
import { FINGERPRINT_WEIGHTS, SIMILARITY } from '../services/Communication/video/video.fingerprint';

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
  transition: 'Transitions (catalogue global : l’agent animateur choisit dans le menu filtré par la direction et la DA)',
  layout: 'Mises en page (archétypes : l’agent directeur artistique en choisit une par scène)',
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
  if (kind === 'technique') {
    return `| Nœud | Directions |\n|---|---|\n${nodes.map((n) => `| \`${n.id}\` | ${Object.keys(n.suits?.directions || {}).join(', ')} |`).join('\n')}`;
  }
  if (kind === 'transition' || kind === 'layout') {
    return `| Nœud | Rôle | Directions (poids) |\n|---|---|---|\n${nodes.map((n) => `| \`${n.id}\` | ${esc(n.summary)} | ${suits(n).replace(/^dir\. /, '')} |`).join('\n')}`;
  }
  const rows = nodes.map((n) => `| \`${n.id}\` | ${esc(n.label)} | ${esc(n.summary)} | ${(n.requires || []).map((r) => `\`${r}\``).join(' ') || '—'} | ${when(n.when)} | ${suits(n)} | ${n.cost} | ${n.determinism} | ${n.impl ? `\`${n.impl}\`` : n.packages ? n.packages.map((p) => `\`${p}\``).join(' ') : '—'} |`);
  return `| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |\n|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}`;
}

function mermaid(): string {
  const shown = CAPABILITIES.filter((n) => !['technique', 'transition', 'layout', 'direction'].includes(n.kind) && n.requires?.length);
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

const ROLE_LABEL: Record<PatternDef['role'], string> = { scene: 'scène', overlay: 'surcouche (accent)', derived: 'lu sur le kit', ultra: 'Ultra (code)' };

function patternTools(p: PatternDef): string {
  const t = p.tools;
  return [
    t.layout && `\`layout:${t.layout}\``,
    t.techniques?.length && `entrées ${t.techniques.slice(0, 3).map((x) => `\`${x}\``).join(' ')}`,
    t.annotate && `\`annotate:${t.annotate}\``,
    t.background && `\`bg:${t.background}\``,
    t.transitionIn?.length && `coupe ${t.transitionIn.map((x) => `\`${x}\``).join(' ')}`,
    t.treatment && `\`treatment:${t.treatment}\``,
    t.logo && `\`logo:${t.logo}\``,
  ]
    .filter(Boolean)
    .join(', ') || '— (écrit en code)';
}

function patternLayer(): string {
  const intents = (Object.keys(INTENTS) as IntentId[])
    .map((id) => `| \`${id}\` | ${INTENTS[id]} | ${capabilitiesForIntent(id).map((c) => CAPABILITY_LABELS[c]).join(', ')} | ${PATTERNS.filter((p) => p.intents.includes(id) && !p.generic).map((p) => `\`${p.id}\``).join(' ')} |`)
    .join('\n');
  const rows = PATTERNS.map((p) => `| \`${p.id}\` | ${esc(p.label)} | ${p.family} | ${ROLE_LABEL[p.role]} | ${p.status === 'experimental' ? 'expérimental' : 'éprouvé'} | ${p.scenes.join(', ')} | ${patternTools(p)} | ${p.kit.map((k) => `\`${k}\``).join(' ') || '—'} |`).join('\n');
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  return `## La couche des motifs (moteur créatif)

Source : \`video.patterns.ts\` (motifs), \`video.planner.ts\` (planificateur), \`video.fingerprint.ts\` (empreinte),
\`video.experience.ts\` (mémoire globale). Le graphe dit ce qui est **possible** ; les motifs disent ce qui est
**intéressant** : intention → capacité → motif → outil → primitive. Un même motif sert à tous les crans : en Low → Max il
se résout en choix du moteur (mise en page, entrée du titre, fond, annotation, coupe) ; en Ultra il donne au codeur les
seules briques de son plan (manifeste restreint).

Score créatif d'un motif = ${Object.entries(CREATIVE_WEIGHTS).map(([k, v]) => `${String(v).replace('.', ',')} × ${({ relevance: 'pertinence', quality: 'qualité', novelty: 'nouveauté', brandFit: 'fidélité à la marque', feasibility: 'faisabilité' } as Record<string, string>)[k]}`).join(' + ')}
+ bonus d'exploration − répétitions dans le film. Part d'exploration par cran : ${(Object.keys(EXPLORATION_BUDGET) as (keyof typeof EXPLORATION_BUDGET)[]).map((l) => `${l} ${pct(EXPLORATION_BUDGET[l])}`).join(' · ')}.
Écart à la vidéo la plus proche du projet : sous ${String(SIMILARITY.tooClose).replace('.', ',')} la vidéo est « trop proche » et le contrôle créatif
la répare (jusqu'au seuil, pas au-delà : la créativité n'est pas la distance maximale) ; au-delà de ${String(SIMILARITY.distinct).replace('.', ',')} elle est
« réellement différente ». Repère indicatif par cran, affiché dans le rapport : ${(Object.keys(NOVELTY_TARGET) as (keyof typeof NOVELTY_TARGET)[]).map((l) => `${l} ${String(NOVELTY_TARGET[l]).replace('.', ',')}`).join(' · ')}.

Poids de l'empreinte : ${Object.entries(FINGERPRINT_WEIGHTS).map(([k, v]) => `${k} ${String(v).replace('.', ',')}`).join(' · ')}.

### Intentions → capacités → motifs

| Intention | Ce qu'elle doit faire ressentir | Capacités | Motifs |
|---|---|---|---|
${intents}

### Les ${PATTERNS.length} motifs

| Motif | Nom | Famille | Rôle | Statut | Scènes | Outils (menus) | Briques du kit (Ultra) |
|---|---|---|---|---|---|---|---|
${rows}
`;
}

const out = `# Graphe de capacités du moteur vidéo

> Fichier généré par \`npm run docs:video-graph\` depuis \`api/services/Communication/video/video.capabilities.ts\`.
> Ne pas éditer à la main. Guide de l'environnement : [VIDEO_ENGINE.md](VIDEO_ENGINE.md).

Le graphe dit ce que la vidéo **peut** utiliser et **quand**. Le routeur (\`resolveKit\`) le parcourt avec le contexte du projet
(type, objectif, direction de motion, direction artistique, logo vectoriel analysé, médias, format, qualité, secteur, vidéos
précédentes) et rend un kit validé, les addons à charger et le vocabulaire court laissé au modèle.

Score d'un nœud possible = 1 + 1,5 × affinité de direction + type + objectif + DA + secteurs − 0,4 × coût (si coût ≥ 2)
− 1,5 s'il a servi dans les deux dernières vidéos du projet ; avec le moteur créatif : + 0,6 × nouveauté (part des vidéos du
projet où il n'a pas servi) + écart appris par la mémoire globale (±0,4, vidéos exportées) + exploration du cran (0,8 × part
d'exploration, pour un nœud compatible que la direction ne porte pas d'ordinaire). Tirage déterministe (graine de la vidéo)
parmi les nœuds à moins de 0,75 du meilleur.

## Arêtes « exige »

${mermaid()}

${(Object.keys(KIND_TITLES) as CapKind[]).map((k) => `## ${KIND_TITLES[k]}\n\n${table(k)}`).join('\n\n')}

${patternLayer()}

## Bibliothèques écartées

| Bibliothèque | Raison |
|---|---|
${EXCLUDED_LIBRARIES.map((e) => `| ${e.name} | ${esc(e.reason)} |`).join('\n')}

## Exemples de décisions (marques de test)

${examples()}
`;

const file = path.resolve(__dirname, '../../docs/VIDEO_CAPABILITIES.md');
fs.writeFileSync(file, out);
console.log(`✓ ${path.relative(process.cwd(), file)} (${CAPABILITIES.length} nœuds, ${PATTERNS.length} motifs)`);
