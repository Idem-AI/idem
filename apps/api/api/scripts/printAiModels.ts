/**
 * Écrit `docs/AI_MODELS.md` : QUEL MODÈLE pour QUELLE fonctionnalité, à QUEL cran de créativité.
 *
 *   npm run ai:matrix
 *
 * Lit la configuration réelle (`ai-models.config.ts`, `creative-roles.ts`, `ai.config.ts`) : le document
 * ne se rédige jamais à la main, il se régénère.
 */
import fs from 'fs';
import path from 'path';
import { CREATIVITY_LEVELS } from '@idem/shared-models';
import { AI_CONFIG, FeatureAIConfig, SectionAIConfig } from '../config/ai.config';
import { CREATIVE_ROLES, roleConfig } from '../config/creative-roles';
import { MODEL_LADDERS, ROLE_LADDERS } from '../config/ai-models.config';

const cell = (v: unknown) => (v === undefined || v === '' ? '—' : `\`${String(v)}\``);
const isFeature = (v: any): v is FeatureAIConfig => v && typeof v === 'object' && typeof v.modelName === 'string' && 'provider' in v;

const out: string[] = [
  '# Modèles IA par fonctionnalité',
  '',
  '> Généré par `npm run ai:matrix` — ne pas éditer à la main. Pour changer un modèle : `apps/api/api/config/ai-models.config.ts` (crans) ou `ai.config.ts` (fonctionnalités indépendantes du cran).',
  '',
  '## 1. Échelles de modèles (un modèle par cran)',
  '',
  `| Échelle | ${CREATIVITY_LEVELS.join(' | ')} |`,
  `|---|${CREATIVITY_LEVELS.map(() => '---').join('|')}|`,
  ...Object.entries(MODEL_LADDERS).map(([name, rungs]) => `| ${name} | ${CREATIVITY_LEVELS.map((l) => cell(rungs[l])).join(' | ')} |`),
  '',
  '## 2. Rôles créatifs (vidéo, livrables graphiques) — modèle et plafond de sortie par cran',
  '',
  `| Rôle | Échelle | ${CREATIVITY_LEVELS.join(' | ')} | Mission |`,
  `|---|---|${CREATIVITY_LEVELS.map(() => '---').join('|')}|---|`,
];
for (const [name, role] of Object.entries(CREATIVE_ROLES)) {
  const cols = CREATIVITY_LEVELS.map((l) => {
    const c = roleConfig(name, role.profile, l);
    return `${cell(c.modelName)} · ${c.llmOptions?.maxOutputTokens ?? '—'} tok`;
  });
  out.push(`| ${name} | ${ROLE_LADDERS[name] ?? '(modèle du profil)'} | ${cols.join(' | ')} | ${role.mission} |`);
}

out.push('', '## 3. Fonctionnalités (`AI_CONFIG`) — indépendantes du cran', '', '| Fonctionnalité | Modèle | Rôle | Température | Tokens max | Raisonnement |', '|---|---|---|---|---|---|');
const walk = (node: any, trail: string[]) => {
  for (const [key, value] of Object.entries(node)) {
    if (isFeature(value)) {
      const o = value.llmOptions || {};
      out.push(`| ${[...trail, key].join('.')} | ${cell(value.modelName)} | ${cell(value.role)} | ${cell(o.temperature)} | ${cell(o.maxOutputTokens)} | ${o.thinkingBudget === 0 ? 'non' : 'oui/auto'} |`);
      for (const [section, s] of Object.entries((value.sections ?? {}) as Record<string, SectionAIConfig>)) {
        const so = { ...o, ...(s.llmOptions || {}) };
        out.push(`| ${[...trail, key].join('.')} › ${section} | ${cell(s.modelName ?? value.modelName)} | ${cell(s.role ?? s.tier ?? value.role)} | ${cell(so.temperature)} | ${cell(so.maxOutputTokens)} | ${so.thinkingBudget === 0 ? 'non' : 'oui/auto'} |`);
      }
    } else if (value && typeof value === 'object') walk(value, [...trail, key]);
  }
};
walk(AI_CONFIG, []);

const file = path.resolve(__dirname, '../../docs/AI_MODELS.md');
fs.writeFileSync(file, out.join('\n') + '\n');
console.log(`écrit : ${file} (${out.length} lignes)`);
