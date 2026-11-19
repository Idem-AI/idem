import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Traductions en deux temps : un noyau au démarrage, le reste à la demande.
 *
 * `ngx-translate` charge le fichier de langue AVANT le premier rendu. Le
 * tableau de bord en a 272 Ko (73 Ko compressés) : autant d'attente avant
 * d'afficher quoi que ce soit, sur une connexion où chaque kilo-octet compte.
 * Or deux espaces de noms — la Communication et la Finance — en représentent
 * un tiers, pour des écrans que la plupart des visites n'ouvrent jamais.
 *
 * Le découpage est fait au build par `scripts/split-i18n.mjs`. Ici :
 *
 * - le chargeur prend `<lang>.core.json` (43 Ko compressés au lieu de 73) ;
 * - les routes concernées attendent leur morceau AVANT de s'activer, via
 *   `translationChunkGuard`. Charger en arrière-plan aurait fait clignoter les
 *   clés brutes à l'écran le temps de l'arrivée.
 *
 * Si un morceau ne se charge pas (réseau coupé au mauvais moment), on retombe
 * sur le fichier complet d'origine, qui reste déployé exprès pour ça.
 */

/** Les morceaux détachés du noyau. Doit rester aligné sur le `prebuild`. */
export type TranslationChunk = 'communication' | 'finance';

const I18N_PREFIX = '/assets/i18n/';

@Injectable({ providedIn: 'root' })
export class TranslationChunkService {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);

  /** Un morceau déjà fusionné ne se recharge pas. */
  private readonly loaded = new Set<string>();
  private readonly pending = new Map<string, Promise<void>>();

  load(chunk: TranslationChunk): Promise<void> {
    const lang = this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'en';
    const key = `${lang}:${chunk}`;

    if (this.loaded.has(key)) return Promise.resolve();

    const already = this.pending.get(key);
    if (already) return already;

    const task = this.fetchAndMerge(lang, chunk)
      .then(() => {
        this.loaded.add(key);
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, task);
    return task;
  }

  private async fetchAndMerge(lang: string, chunk: TranslationChunk): Promise<void> {
    try {
      const part = await this.get(`${I18N_PREFIX}${lang}.${chunk}.json`);
      // `true` : fusion, et non remplacement — le noyau doit survivre.
      this.translate.setTranslation(lang, part, true);
    } catch {
      // Filet : le fichier complet d'origine, toujours déployé.
      try {
        const full = await this.get(`${I18N_PREFIX}${lang}.json`);
        this.translate.setTranslation(lang, full, true);
      } catch {
        // Ni morceau ni fichier complet : la page s'affichera avec ses clés
        // plutôt que de ne pas s'afficher du tout.
      }
    }
  }

  private get(url: string): Promise<TranslationObject> {
    return new Promise((resolve, reject) => {
      this.http.get<TranslationObject>(url).subscribe({
        next: resolve,
        error: reject,
      });
    });
  }
}

/**
 * Garde de route : la page n'apparaît qu'une fois ses textes présents.
 *
 * @example
 * ```ts
 * { path: 'project/finance', canActivate: [translationChunkGuard('finance')], … }
 * ```
 */
export function translationChunkGuard(chunk: TranslationChunk) {
  return async (): Promise<boolean> => {
    await inject(TranslationChunkService).load(chunk);
    return true;
  };
}

/**
 * Le chargeur du noyau. Remplace `provideTranslateHttpLoader`, qui irait
 * chercher `<lang>.json` entier.
 */
@Injectable()
export class CoreTranslationLoader implements TranslateLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`${I18N_PREFIX}${lang}.core.json`).pipe(
      catchError(() =>
        // Noyau absent (build sans l'étape de découpage) : le fichier complet
        // fait parfaitement l'affaire, il est seulement plus lourd.
        this.http.get<TranslationObject>(`${I18N_PREFIX}${lang}.json`),
      ),
    );
  }
}
