/**
 * LE PIPELINE DE PRODUCTION D'UN LOGO — construire, mesurer, corriger, jusqu'au seuil.
 *
 *   1. valider le Logo IR (le schéma ramène les nombres dans leurs bornes)
 *   2. construire le SVG (noyau géométrique + polices vectorisées)
 *   3. mesurer (technique + visuel, déterministe)
 *   4. corriger par patch ciblé ce qui est corrigeable — au plus 2 tours, jusqu'au seuil
 *
 * Aucun modèle n'intervient ici. L'agent (`agent/`) décide quoi dessiner ; ce pipeline garantit
 * que ce qui sort est exploitable.
 */
import type { LogoDocument } from './ir/logo.schema';
import { buildLogo } from './render/build';
import type { BuildOptions, LogoSession, RenderedLogo } from './render/build';
import { fingerprintOf } from './validate/fingerprint';
import type { LogoFingerprint } from './validate/fingerprint';
import { assessLogo } from './validate/assess';
import type { QualityReport } from './validate/assess';
import { fixOnce } from './validate/autofix';
import type { FixLog } from './validate/autofix';

export interface ProducedLogo {
  doc: LogoDocument;
  session: LogoSession;
  rendered: RenderedLogo;
  report: QualityReport;
  fingerprint: LogoFingerprint | null;
  /** Corrections appliquées (une ligne par défaut corrigé). */
  fixes: FixLog[];
}

export interface ProduceResult {
  ok: boolean;
  errors: string[];
  logo?: ProducedLogo;
}

export const MAX_FIX_ROUNDS = 2;

export async function produceLogo(input: unknown, options: BuildOptions, config: { fix?: boolean; rounds?: number; skipVariants?: boolean } = {}): Promise<ProduceResult> {
  const first = await buildLogo(input, options);
  if (!first.ok || !first.session || !first.rendered || !first.doc) return { ok: false, errors: first.errors };

  let doc: LogoDocument = first.doc;
  let session: LogoSession = first.session;
  let rendered: RenderedLogo = first.rendered;
  let report = await assessLogo(session, rendered, { skipVariants: config.skipVariants });
  const fixes: FixLog[] = [];
  const rounds = config.fix === false ? 0 : config.rounds ?? MAX_FIX_ROUNDS;
  for (let round = 0; round < rounds && !report.accepted; round++) {
    const fixed = fixOnce(doc, report.defects);
    if (!fixed) break;
    const next = await buildLogo(fixed.doc, options);
    if (!next.ok || !next.session || !next.rendered || !next.doc) break;
    const nextReport = await assessLogo(next.session, next.rendered, { skipVariants: config.skipVariants });
    // Une correction ne doit jamais aggraver : sinon on garde l'état d'avant.
    if (nextReport.score < report.score || (!nextReport.ok && report.ok)) break;
    doc = next.doc;
    session = next.session;
    rendered = next.rendered;
    report = nextReport;
    fixes.push(...fixed.log);
  }

  const fingerprint = await fingerprintOf(session).catch(() => null);
  return {
    ok: report.ok,
    errors: report.ok ? [] : report.defects.filter((d) => d.severity === 'blocker').map((d) => d.message),
    logo: { doc, session, rendered, report, fingerprint, fixes },
  };
}
