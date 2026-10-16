import { AsyncLocalStorage } from 'async_hooks';

/**
 * Les plans filmés par l'IA qu'une création a COMMANDÉS (et payés, 1 000 F l'un) : le modèle
 * vidéo n'est appelé que dans cette limite. Au-delà — ou sans commande — l'appel est refusé
 * comme un défaut de paiement, et le moteur bascule sur la banque d'images (disjoncteur de
 * `sourcing.ts`). Hors de toute création (scripts), aucune limite n'est posée ici.
 */
interface ClipAllowance {
  ordered: number;
  used: number;
}

const storage = new AsyncLocalStorage<ClipAllowance>();

export function withClipAllowance<T>(ordered: number, fn: (allowance: Readonly<ClipAllowance>) => Promise<T>): Promise<T> {
  const allowance: ClipAllowance = { ordered: Math.max(0, Math.floor(ordered)), used: 0 };
  return storage.run(allowance, () => fn(allowance));
}

/** Prend un plan sur la commande ; lève une erreur « 402 » s'il n'en reste pas. */
export function takeClip(): void {
  const allowance = storage.getStore();
  if (!allowance) return;
  if (allowance.used >= allowance.ordered) {
    throw Object.assign(new Error('402 payment required: ai_clip_not_ordered'), { status: 402 });
  }
  allowance.used += 1;
}

/** Rend un plan dont la génération a échoué : il n'est pas facturé. */
export function giveBackClip(): void {
  const allowance = storage.getStore();
  if (allowance && allowance.used > 0) allowance.used -= 1;
}
