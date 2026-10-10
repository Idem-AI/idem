/** Charge une feuille de polices (Google Fonts) une seule fois, pour montrer une typographie proposée. */
const loaded = new Set<string>();

export function loadFontSheet(url?: string): void {
  if (!url || loaded.has(url) || typeof document === 'undefined' || !/^https:\/\/fonts\.googleapis\.com\//.test(url)) return;
  loaded.add(url);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}
