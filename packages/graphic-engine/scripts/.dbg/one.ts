import { configureGraphicEngine } from '../../src/host';
import { createDocument } from '../../src/engine';
import { closeBrowser } from '../../src/runtime/browser';
import { catalog } from '../../src/catalog/registry';
import * as F from '../fixtures';
process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
process.env.IDEM_TEMPLATES_DIR = process.env.IDEM_TEMPLATES_DIR || '/Users/pharaon/Documents/pharaon/IDEM AFRICA/idem-templates';
const [gid, fixture, format, documentType] = process.argv.slice(2);
(async () => {
  const cat = await catalog();
  const others = [...cat.nodes.values()].filter((n) => n.kind === 'gabarit' && n.id !== gid).map((n) => n.id);
  configureGraphicEngine({ catalogOverrides: async () => ({ disabled: others }), logger: { info: () => {}, warn: (m: string, x?: unknown) => console.log('WARN', m, JSON.stringify(x)?.slice(0, 300)), error: (m: string, x?: unknown) => console.log('ERR', m, x) } });
  const content = fixture === 'coverphoto' ? { ...F.coverSection('Kora', 'Pitch deck', 'Fintech', 'Le crédit simple pour les commerçants de Douala'), blocks: [...F.coverSection('Kora', 'Pitch deck', 'Fintech', 'Le crédit simple pour les commerçants de Douala').blocks, { id: 'ph', kind: 'figure', url: F.photo('#1A2A4F', '#7F9CE5', '#C9A227'), alt: 'x' }] } : fixture === 'shortphoto' ? { id: 'banner', role: 'visual', title: 'Bannière', blocks: [{ id: 'copy', kind: 'copy', kicker: 'Fintech à Douala', headline: 'Le crédit simple pour les commerçants' }, { id: 'ph', kind: 'figure', url: F.photo('#1A2A4F', '#7F9CE5', '#C9A227'), alt: 'x' }] } as any : fixture === 'short' ? { id: 'banner', role: 'visual', title: 'Bannière', blocks: [{ id: 'copy', kind: 'copy', kicker: 'Fintech à Douala', headline: 'Le crédit simple pour les commerçants' }] } as any : fixture === 'cover' ? F.coverSection('Kora', 'Pitch deck', 'Fintech', 'Le crédit simple') : fixture.startsWith('flyer') ? F.flyer(fixture === 'flyer-photo', { a: '#1A2A4F', b: '#7F9CE5', c: '#C9A227' }) : fixture.startsWith('charter') ? F.CHARTER(F.BRANDS.kora)[Number(fixture.slice(7))] : (F as any)[fixture];
  const doc = await createDocument({ documentType: documentType as any, format: format as any, brand: F.BRANDS.kora, direction: { styleId: 'swiss' }, creativity: 'low', seed: 'dbg', png: true, sections: [{ id: content.id, role: content.role }] });
  try {
    const out = await doc.composeSection(content);
    console.log('CONFIG', JSON.stringify(out.spec.catalog?.config));
    for (const r of out.result.repairs ?? []) console.log('REPAIR', r.code, r.detail);
    for (const i of out.result.issues) console.log('ISSUE', i.severity, i.code, i.message.slice(0, 300));
    if (out.png) require('fs').writeFileSync('/private/tmp/claude-501/-Users-pharaon-Documents-pharaon-IDEM-AFRICA/3fc5af67-5820-406c-b15f-48b5394cd7f0/scratchpad/dbg.png', out.png);
    require('fs').writeFileSync('/private/tmp/claude-501/-Users-pharaon-Documents-pharaon-IDEM-AFRICA/3fc5af67-5820-406c-b15f-48b5394cd7f0/scratchpad/dbg.html', out.spec.html);
  } catch (e) { console.log('FAIL', e); }
  await closeBrowser();
})();
