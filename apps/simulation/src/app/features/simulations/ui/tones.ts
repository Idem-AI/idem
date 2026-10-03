import { Verdict } from '../models';

/** Les quatre teintes de `.sim-pill`, toujours accompagnées d'un mot. */
export type Tone = 'go' | 'warn' | 'stop' | 'info' | 'muted';

/** Gravité d'un problème, quel que soit le vocabulaire de l'analyse qui l'a produit. */
export function severityTone(severity: string): Tone {
  switch (severity) {
    case 'critical':
      return 'stop';
    case 'high':
    case 'important':
      return 'warn';
    default:
      return 'muted';
  }
}

export function verdictTone(verdict: Verdict | undefined | null): Tone {
  switch (verdict) {
    case 'go':
      return 'go';
    case 'no-go':
      return 'stop';
    case 'go-with-conditions':
      return 'warn';
    default:
      return 'muted';
  }
}

/** Teinte d'une note sur 100 : la même échelle que la jauge. */
export function scoreTone(value: number | undefined | null): Tone {
  if (value === undefined || value === null) {
    return 'muted';
  }
  if (value >= 65) {
    return 'go';
  }
  return value >= 45 ? 'warn' : 'stop';
}

/** Montant arrondi, séparateurs à la française, devise en clair. */
export function formatMoney(value: number, currency: string): string {
  return `${Math.round(value).toLocaleString('fr-FR')} ${currency}`.trim();
}
