/**
 * SITE OU APPLICATION, pour une demande écrite sur la page d'accueil.
 *
 * Sans produit dans l'adresse, iCode construisait une application complète (interface, serveur, base de données),
 * même pour « un site pour mon restaurant ». Avant d'ouvrir l'atelier, un agent du serveur lit la demande
 * (`POST /api/commands/kind`) et l'adresse reçoit `?product=site` ou `?product=app` (et `?platform=`) : le socle
 * monté, la génération et l'aperçu (instantané pour un site) suivent. Rien n'est demandé à l'utilisateur ; sans
 * réponse en 4,5 s, ou si l'agent hésite, rien ne change.
 */
import { currentProduct } from './product';

const API_BASE = process.env.REACT_APP_NEXT_API_BASE_URL || 'http://localhost:3000';
const TIMEOUT_MS = 4_500;

export async function decideProductFromPrompt(text: string | undefined): Promise<void> {
  if (!text?.trim() || currentProduct()) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/api/commands/kind`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!response.ok) return;
    const kind = (await response.json()) as { product?: 'site' | 'app' | null; platform?: 'web' | 'mobile' | null };
    if (kind.product !== 'site' && kind.product !== 'app') return;
    const url = new URL(window.location.href);
    url.searchParams.set('product', kind.product);
    if (kind.product === 'app') url.searchParams.set('platform', kind.platform === 'mobile' ? 'mobile' : 'web');
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    /* agent muet : le chemin habituel décide */
  } finally {
    clearTimeout(timer);
  }
}
