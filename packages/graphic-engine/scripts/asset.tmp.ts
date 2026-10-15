import fs from 'fs';
import { createDocument, closeBrowser, configureGraphicEngine } from '../src';
import { BRANDS, logo, icon } from './fixtures';
const OUT = '/private/tmp/claude-501/-Users-pharaon-Documents-pharaon-IDEM-AFRICA/93b5b59f-bd38-49d6-8168-d44992be5f4f/scratchpad';
configureGraphicEngine({ agentCall: undefined });
const mock = (w: number, h: number, c: string) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff" stroke="#ccc"/><rect x="20" y="20" width="${w - 40}" height="${h * 0.6}" fill="${c}"/></svg>`).toString('base64')}`;
const patt = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="14" y="14" width="10" height="10" transform="rotate(45 19 19)" fill="#2d6a4f"/></svg>').toString('base64')}`;
(async () => {
  for (const format of ['slide-16x9', 'page-a4'] as const) {
    const doc = await createDocument({ documentType: 'brand-charter', format, brand: BRANDS.baobab, seed: 'a', png: true, sections: [] });
    const pages: any[] = [
      { id: 'story', title: 'Le logo', lede: 'Trois losanges forment un V.', blocks: [{ id: 'sys-1', kind: 'logoStory', origin: 'system', url: logo('Baobab', '#1B5E20', '#2E7D32'), label: 'Logo', background: 'light', points: [{ label: 'Le symbole', text: 'Trois losanges dessinent un V ascendant.' }, { label: 'Le nom', text: 'Sora, graisse 700, casse haute.' }, { label: 'Les couleurs', text: 'Vert profond, vert sauge, orange.' }] }] },
      { id: 'mark', title: 'Symbole seul', blocks: [{ id: 'sys-1', kind: 'logoDisplay', origin: 'system', variants: [{ url: icon('#2E7D32'), label: 'Icône', background: 'light' }] }] },
      { id: 'dark', title: 'Déclinaison sur fond sombre', blocks: [{ id: 'sys-1', kind: 'logoDisplay', origin: 'system', variants: [{ url: logo('Baobab', '#FFFFFF', '#F57C00'), label: 'Sombre', background: 'dark' }] }] },
      { id: 'patterns', title: 'Motifs graphiques', blocks: [{ id: 'sys-1', kind: 'patternGrid', origin: 'system', patterns: [{ name: 'Motif principal', motif: 'dots', ink: '#2d6a4f', ground: '#f9fbfb', url: patt, tile: 40 }, { name: 'Trame fine', motif: 'grid', ink: '#2d6a4f', ground: '#eef2ef' }, { name: 'Motif inversé', motif: 'stripes', ink: '#f9fbfb', ground: '#2d6a4f' }, { name: 'Rappel', motif: 'arcs', ink: '#f4a261', ground: '#f9fbfb' }] }] },
      { id: 'palette', title: 'Palette de couleurs', blocks: [{ id: 'sys-1', kind: 'swatches', origin: 'system', items: [{ hex: '#1B5E20', name: 'Primaire', role: 'Identité, titres, aplats' }, { hex: '#F2C14E', name: 'Secondaire', role: 'Support, zones calmes' }, { hex: '#F57C00', name: 'Accent', role: 'Chiffres, appels' }, { hex: '#FFFFFF', name: 'Fond', role: 'Surface de page' }, { hex: '#1A1A1A', name: 'Encre', role: 'Texte courant' }] }] },
      { id: 'scale', title: 'Hiérarchie typographique', blocks: [{ id: 'sys-1', kind: 'typeScale', origin: 'system', levels: [{ label: 'Titre', family: 'Sora', step: '3xl', weight: 700, sample: 'Baobab', usage: 'Ouverture' }, { label: 'Sous-titre', family: 'Sora', step: 'xl', weight: 600, sample: 'Une idée par page' }, { label: 'Chapô', family: 'Inter', step: 'lg', weight: 400, sample: 'La phrase qui énonce le constat' }, { label: 'Texte', family: 'Inter', step: 'base', weight: 400, sample: 'Le texte courant du document' }, { label: 'Légende', family: 'Inter', step: 'xs', weight: 500, sample: 'Mention, note, source' }] }] },
      { id: 'posts', title: 'Publications sociales', blocks: [{ id: 'sys-1', kind: 'mockupShowcase', origin: 'system', items: [{ url: mock(540, 760, '#2d6a4f'), label: 'LinkedIn', ratio: 0.71 }, { url: mock(540, 760, '#f4a261'), label: 'Facebook', ratio: 0.71 }] }] },
      { id: 'banners', title: 'Bannières réseaux sociaux', blocks: [{ id: 'sys-1', kind: 'mockupShowcase', origin: 'system', items: [{ url: mock(1128, 300, '#2d6a4f'), label: 'LinkedIn', ratio: 3.76 }, { url: mock(1640, 624, '#f4a261'), label: 'Facebook', ratio: 2.63 }] }] },
    ];
    for (const p of pages.filter((x) => ['palette', 'scale'].includes(x.id))) {
      const out = await doc.composeSection(p);
      fs.writeFileSync(`${OUT}/asset-${format}-${p.id}.png`, out.png!);
      console.log(format, p.id, out.result.repairs.map((r) => r.code).join(','), out.result.issues.map((i) => i.code).join(','));
    }
  }
  await closeBrowser();
})().catch(async (e) => { console.error(e); await closeBrowser(); });
