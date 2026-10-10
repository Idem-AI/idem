import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EDITOR_I18N, EditorDictionary } from './editor.i18n';

/** La langue de l'appli hôte (ngx-translate), sinon celle de la page ; français par défaut. */
export function editorLanguage(translate: TranslateService | null): 'fr' | 'en' {
  const lang = (translate?.currentLang || translate?.getDefaultLang?.() || (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'fr').toLowerCase();
  return lang.startsWith('en') ? 'en' : 'fr';
}

/** Un texte de l'éditeur, avec ses paramètres `{{ nom }}` ; la clé elle-même si elle manque. */
export function editorText(lang: 'fr' | 'en', key: string, params?: Record<string, unknown>): string {
  let node: string | EditorDictionary | undefined = EDITOR_I18N[lang];
  for (const part of key.split('.')) node = node && typeof node === 'object' ? node[part] : undefined;
  if (typeof node !== 'string') return key;
  return params ? node.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => String(params[name] ?? '')) : node;
}

/**
 * `{{ 'toolbar.save' | idemEditorT }}` — les textes de l'éditeur partagé, dans la langue de
 * l'appli. Impur : il suit un changement de langue sans recharger l'éditeur.
 */
@Pipe({ name: 'idemEditorT', pure: false })
export class EditorTranslatePipe implements PipeTransform {
  private readonly translate = inject(TranslateService, { optional: true });

  transform(key: string, params?: Record<string, unknown>): string {
    return editorText(editorLanguage(this.translate), key, params);
  }
}
