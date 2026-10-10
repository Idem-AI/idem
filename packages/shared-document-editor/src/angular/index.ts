/**
 * @idem/shared-document-editor/angular — l'éditeur WYSIWYG et l'aperçu éditable d'IDEM et
 * d'iVision. Un seul moteur : une fonctionnalité ajoutée ici vaut dans les deux produits.
 */
export * from './models/editor.types';
export * from './document-editor/document-editor';
export * from './document-preview/document-preview';
export * from './components/editor-canvas/editor-canvas';
export * from './components/zoom-control/zoom-control';
export * from './runtime/editor-iframe';
export * from './utils/sanitize-section';
export * from './services/document-model.service';
export * from './services/editor-history.service';
export * from './i18n/editor-translate.pipe';
export * from './i18n/editor.i18n';
