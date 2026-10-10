/**
 * Matrice de comparaison OpenRouter — vérifie la liste blanche contre le
 * catalogue EN DIRECT et écrit `docs/OPENROUTER_MODEL_MATRIX.md`.
 *
 *   npm run openrouter:matrix            → vérifie + écrit la matrice
 *   npm run openrouter:matrix -- --probe → ajoute un test de français (clé requise)
 *
 * Trois preuves par modèle, relues à chaque exécution :
 *   1. l'identifiant existe encore au catalogue OpenRouter ;
 *   2. `hugging_face_id` (poids publics) correspond à la liste blanche ;
 *   3. la licence de la fiche Hugging Face est celle déclarée.
 * Le script signale aussi les modèles OUVERTS du catalogue (Qwen, DeepSeek, FLUX)
 * qui ne sont pas encore en liste blanche — les candidats à examiner.
 *
 * Le test de français est INDICATIF (langue détectée, accents, caractères
 * parasites, latence, coût) : il écarte les modèles qui dérapent, il ne remplace
 * pas une relecture humaine des livrables.
 */

import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';

import { loadSecrets } from '../config/secrets';
import {
  OPENROUTER_BASE_URL,
  OPENROUTER_DEFAULT_ROLES,
  OPENROUTER_MODELS,
  OpenRouterModel,
  VERIFIED_ON,
  getOpenRouterApiKey,
} from '../config/openrouter.config';

interface CatalogEntry {
  id: string;
  hugging_face_id?: string | null;
  pricing?: Record<string, string>;
  context_length?: number;
}

const BASE = OPENROUTER_BASE_URL();

async function catalog(query: string): Promise<Map<string, CatalogEntry>> {
  const { data } = await axios.get<{ data: CatalogEntry[] }>(`${BASE}${query}`, { timeout: 30_000 });
  return new Map(data.data.map((entry) => [entry.id, entry]));
}

async function huggingFaceLicense(hfId: string): Promise<string> {
  try {
    const { data } = await axios.get(`https://huggingface.co/api/models/${hfId}`, { timeout: 20_000 });
    return String(data?.cardData?.license ?? data?.tags?.find((t: string) => t.startsWith('license:'))?.slice(8) ?? 'inconnue');
  } catch {
    return 'illisible';
  }
}

const FRENCH_WORDS = /\b(le|la|les|des|une|un|et|pour|dans|votre|vous|avec|est|sont|du|au|que|qui)\b/gi;
const ENGLISH_WORDS = /\b(the|and|for|with|your|you|is|are|of|to|that|this)\b/gi;

/** 0–4 : français dominant, accents, aucun caractère CJK, longueur raisonnable. */
function scoreFrench(text: string): number {
  const fr = (text.match(FRENCH_WORDS) ?? []).length;
  const en = (text.match(ENGLISH_WORDS) ?? []).length;
  let score = 0;
  if (fr >= 6 && fr > en * 2) score++;
  if (/[éèêàùçôî]/i.test(text)) score++;
  if (!/[぀-ヿ㐀-鿿]/.test(text)) score++;
  if (text.length >= 80 && text.length <= 900) score++;
  return score;
}

async function probeFrench(model: OpenRouterModel): Promise<{ score: number; ms: number; costUsd: number } | null> {
  const key = getOpenRouterApiKey();
  if (!key || model.kind !== 'text') return null;
  const started = Date.now();
  try {
    const { data } = await axios.post(
      `${BASE}/chat/completions`,
      {
        model: model.id,
        messages: [
          {
            role: 'user',
            content:
              "Rédige en français, en trois phrases, l'accroche d'une boulangerie artisanale à Abidjan qui ouvre un second point de vente. Ton chaleureux, vouvoiement, aucun anglicisme.",
          },
        ],
        max_tokens: 400,
        temperature: 0.7,
        reasoning: { enabled: false },
        provider: { data_collection: 'deny' },
      },
      { headers: { Authorization: `Bearer ${key}` }, timeout: 90_000 }
    );
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const usage = data?.usage ?? {};
    const costUsd =
      ((usage.prompt_tokens ?? 0) * (model.pricing?.input ?? 0) +
        (usage.completion_tokens ?? 0) * (model.pricing?.output ?? 0)) / 1_000_000;
    return { score: scoreFrench(text), ms: Date.now() - started, costUsd };
  } catch {
    return null;
  }
}

function priceLabel(model: OpenRouterModel): string {
  const p = model.pricing;
  if (!p) return '—';
  if (p.perImage !== undefined) return `${p.perImage.toFixed(4)} $/image`;
  return `${p.input} / ${p.output} $/M`;
}

async function main(): Promise<void> {
  await loadSecrets();
  const probe = process.argv.includes('--probe');

  const [text, image, video] = await Promise.all([
    catalog('/models'),
    catalog('/models?output_modalities=image'),
    catalog('/videos/models').catch(() => new Map<string, CatalogEntry>()),
  ]);
  const live = new Map<string, CatalogEntry>([...text, ...image, ...video]);

  const problems: string[] = [];
  const rows: string[] = [];

  for (const model of OPENROUTER_MODELS) {
    const entry = live.get(model.id);
    if (!entry) {
      problems.push(`✗ ${model.id} : absent du catalogue OpenRouter`);
      rows.push(`| \`${model.id}\` | ${model.kind} | **retiré** | — | — | — | — | — |`);
      continue;
    }

    const liveHf = entry.hugging_face_id || undefined;
    if (model.openWeights && !liveHf) problems.push(`✗ ${model.id} : plus de hugging_face_id (poids retirés ?)`);
    if (model.openWeights && liveHf && liveHf !== model.hfId) {
      problems.push(`✗ ${model.id} : dépôt HF changé (${model.hfId} → ${liveHf})`);
    }
    if (!model.openWeights && liveHf) problems.push(`! ${model.id} : poids désormais publiés (${liveHf}) — à réexaminer`);

    let license = model.license;
    if (model.openWeights && liveHf) {
      license = await huggingFaceLicense(liveHf);
      if (license !== model.license) problems.push(`✗ ${model.id} : licence ${model.license} → ${license}`);
    }

    const liveIn = Number(entry.pricing?.prompt) * 1e6;
    const liveOut = Number(entry.pricing?.completion) * 1e6;
    if (model.pricing?.input !== undefined && Number.isFinite(liveIn) && Math.abs(liveIn - model.pricing.input) > model.pricing.input * 0.25) {
      problems.push(`! ${model.id} : prix entrée ${model.pricing.input} → ${liveIn.toFixed(3)} $/M`);
    }
    if (model.pricing?.output !== undefined && Number.isFinite(liveOut) && Math.abs(liveOut - model.pricing.output) > model.pricing.output * 0.25) {
      problems.push(`! ${model.id} : prix sortie ${model.pricing.output} → ${liveOut.toFixed(3)} $/M`);
    }

    let french = 'à mesurer';
    if (probe && model.kind === 'text') {
      const result = await probeFrench(model);
      french = result ? `${result.score}/4 · ${(result.ms / 1000).toFixed(1)} s` : 'échec';
    } else if (model.kind !== 'text') {
      french = model.kind === 'image' ? 'texte dans l’image : à tester' : 'n/a';
    }

    const used = Object.entries(OPENROUTER_DEFAULT_ROLES).filter(([, id]) => id === model.id).map(([role]) => role);
    rows.push(
      `| \`${model.id}\` | ${model.kind} | ${model.openWeights ? `oui · ${license}` : '**non** (API fermée)'} | ${model.commercialOk ? 'oui' : '**non**'} | ${french} | ${priceLabel(model)} | ${model.selfHost} | ${used.length ? `**défaut ${used.join(', ')}**` : model.roles.join(', ') || '—'} |`
    );
  }

  // Modèles ouverts du catalogue pas encore examinés.
  const listed = new Set(OPENROUTER_MODELS.map((m) => m.id));
  const unexamined = [...live.values()]
    .filter((e) => e.hugging_face_id && !e.id.includes(':') && /^(qwen|deepseek|black-forest-labs)\//.test(e.id) && !listed.has(e.id))
    .map((e) => e.id)
    .sort();

  const md = [
    '# Matrice des modèles OpenRouter',
    '',
    `Générée le ${new Date().toISOString().slice(0, 10)} par \`npm run openrouter:matrix\` (liste blanche vérifiée le ${VERIFIED_ON}). Ne pas éditer à la main : modifier \`config/openrouter.config.ts\`.`,
    '',
    '**Open-weight = `hugging_face_id` au catalogue + licence lue sur Hugging Face.** « Disponible sur OpenRouter » ne prouve rien.',
    '',
    '| Identifiant OpenRouter | Type | Poids ouverts · licence | Usage commercial | Français | Coût | Auto-hébergement | Rôle |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Écarts constatés à l’exécution',
    problems.length ? problems.map((p) => `- ${p}`).join('\n') : '- aucun',
    '',
    '## Modèles ouverts du catalogue non encore examinés',
    unexamined.length ? unexamined.map((id) => `- \`${id}\``).join('\n') : '- aucun',
    '',
  ].join('\n');

  const target = path.resolve(__dirname, '../../docs/OPENROUTER_MODEL_MATRIX.md');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, md);

  console.log(md);
  console.log(`\n→ ${target}`);
  if (problems.some((p) => p.startsWith('✗'))) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
