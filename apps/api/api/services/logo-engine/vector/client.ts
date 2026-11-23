/**
 * LE MODÈLE VECTORIEL — un modèle qui dessine des tracés (OmniSVG), servi par idem-ml.
 *
 * Le moteur ne connaît que l'interface `VectorModel` : l'implémentation HTTP ci-dessous parle au
 * serveur `idem-ml/services/omnisvg` ; un test lui substitue un faux modèle. Rien ici ne charge de
 * poids ni ne dépend d'IDEM : l'hôte (`idem.service.ts`) fournit l'adresse et la clé.
 *
 * Règle de conduite : le modèle vectoriel est un PLUS. Absent, lent, occupé ou en panne, il rend
 * une liste vide et le moteur fait exactement ce qu'il faisait sans lui. Après une panne, il est
 * laissé de côté quelques instants (disjoncteur) pour ne pas faire attendre chaque logo.
 */

export interface VectorCandidate {
  /** SVG brut du modèle (viewBox 0 0 200 200 pour OmniSVG, tracés `fill` peints dans l'ordre). */
  svg: string;
  paths: number;
}

export interface VectorRequestOptions {
  /** Candidats par demande (1 à 8). */
  candidates?: number;
  seed?: number;
  /** Au-delà, la demande est abandonnée (côté client ET côté serveur). */
  deadlineMs?: number;
}

export interface VectorModel {
  readonly name: string;
  /** Plusieurs demandes en une passe : `Map<id, candidats>` (une demande sans résultat a une liste vide). */
  textToSvg(prompts: { id: string; text: string }[], options?: VectorRequestOptions): Promise<Map<string, VectorCandidate[]>>;
  /** Une image (PNG) → ses candidats vectoriels. */
  imageToSvg(png: Buffer, options?: VectorRequestOptions): Promise<VectorCandidate[]>;
}

export interface OmniSvgClientConfig {
  url: string;
  apiKey?: string;
  /** Échéance par défaut d'une demande (ms). */
  deadlineMs?: number;
  /** Plafond de candidats par demande (machine lente : moins de candidats). */
  maxCandidates?: number;
  /** Jetons générés au plus par symbole (256–2048). */
  maxTokens?: number;
  /** Temps pendant lequel le modèle est laissé de côté après une panne (ms). */
  cooldownMs?: number;
  /** Journal de l'hôte (sans contenu). */
  log?: (message: string) => void;
  fetchImpl?: typeof fetch;
}

const clampInt = (v: number | undefined, min: number, max: number, def: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v as number))) : def);

export class OmniSvgClient implements VectorModel {
  readonly name = 'omnisvg';
  private downUntil = 0;
  private readonly base: string;

  constructor(private readonly config: OmniSvgClientConfig) {
    this.base = config.url.replace(/\/+$/, '');
  }

  /** Disponible maintenant (le disjoncteur n'est pas ouvert). */
  get available(): boolean {
    return Date.now() >= this.downUntil;
  }

  async textToSvg(prompts: { id: string; text: string }[], options: VectorRequestOptions = {}): Promise<Map<string, VectorCandidate[]>> {
    const out = new Map<string, VectorCandidate[]>(prompts.map((p) => [p.id, []]));
    if (!prompts.length || !this.available) return out;
    const deadline = clampInt(options.deadlineMs ?? this.config.deadlineMs, 1000, 600_000, 90_000);
    const body = {
      prompts: prompts.slice(0, 8).map((p) => ({ id: p.id.slice(0, 40), text: p.text.slice(0, 600) })),
      candidates: clampInt(options.candidates, 1, this.config.maxCandidates ?? 8, Math.min(4, this.config.maxCandidates ?? 8)),
      subtype: 'icon',
      max_tokens: clampInt(this.config.maxTokens, 256, 2048, 1024),
      deadline_ms: deadline,
      ...(options.seed !== undefined ? { seed: options.seed % 2 ** 31 } : {}),
    };
    const json = await this.post('/v1/text-to-svg', body, deadline);
    const results = (json as { results?: { id?: string; candidates?: VectorCandidate[] }[] } | null)?.results;
    for (const r of Array.isArray(results) ? results : []) {
      if (r?.id && out.has(r.id)) out.set(r.id, (r.candidates ?? []).filter(isCandidate));
    }
    return out;
  }

  async imageToSvg(png: Buffer, options: VectorRequestOptions = {}): Promise<VectorCandidate[]> {
    if (!this.available) return [];
    const deadline = clampInt(options.deadlineMs ?? this.config.deadlineMs, 1000, 600_000, 90_000);
    const body = {
      image_base64: png.toString('base64'),
      candidates: clampInt(options.candidates, 1, this.config.maxCandidates ?? 8, Math.min(4, this.config.maxCandidates ?? 8)),
      replace_background: true,
      max_tokens: clampInt(this.config.maxTokens, 256, 2048, 1536),
      deadline_ms: deadline,
      ...(options.seed !== undefined ? { seed: options.seed % 2 ** 31 } : {}),
    };
    const json = await this.post('/v1/image-to-svg', body, deadline);
    const list = (json as { candidates?: VectorCandidate[] } | null)?.candidates;
    return Array.isArray(list) ? list.filter(isCandidate) : [];
  }

  private async post(path: string, body: unknown, deadline: number): Promise<unknown | null> {
    const controller = new AbortController();
    // Le serveur tient l'échéance dans sa file ; le client lui laisse le temps de répondre.
    const timer = setTimeout(() => controller.abort(), deadline + 5000);
    const started = Date.now();
    try {
      const res = await (this.config.fetchImpl ?? fetch)(`${this.base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        // 503 « occupé » ou « échéance » : pas une panne, on ne coupe pas. Le reste (401, 5xx, chargement) : disjoncteur.
        const detail = await res.text().catch(() => '');
        const busy = res.status === 503 && /occup|échéance|echeance/i.test(detail);
        if (!busy) this.trip();
        this.config.log?.(`[OmniSVG] ${path} → HTTP ${res.status}${busy ? ' (occupé)' : ''} en ${Date.now() - started} ms`);
        return null;
      }
      return await res.json();
    } catch (error) {
      this.trip();
      this.config.log?.(`[OmniSVG] ${path} injoignable en ${Date.now() - started} ms : ${(error as Error).name}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private trip(): void {
    this.downUntil = Date.now() + (this.config.cooldownMs ?? 60_000);
  }
}

function isCandidate(c: unknown): c is VectorCandidate {
  const v = c as VectorCandidate | null;
  return !!v && typeof v.svg === 'string' && v.svg.includes('<svg') && v.svg.length < 400_000;
}
