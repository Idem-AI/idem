/**
 * Logo IDEM des e-mails, et bascule clair / sombre.
 *
 * **Joint au message (cid:), jamais chargé depuis le web.** Gmail, Outlook et
 * Apple Mail bloquent les images distantes d'un expéditeur qu'ils ne
 * connaissent pas encore. Joint, le logo s'affiche sans clic sur « Afficher
 * les images ».
 *
 * **Deux déclinaisons, choisies par la messagerie.**
 *  - Par défaut : la version toute bleue, sur fond blanc. C'est celle que
 *    voient Gmail (qui ne dit jamais si son lecteur est en mode sombre), les
 *    messageries qui retirent les styles et Outlook pour Windows.
 *  - En mode sombre : la version « EM » blanc, et la carte passe sur fond
 *    sombre dans la même règle — un « EM » blanc sur une carte restée blanche
 *    disparaîtrait. Apple Mail, Outlook (Mac, iOS, Android, Outlook.com),
 *    Thunderbird et Samsung Mail appliquent cette règle.
 *
 * Les mises en page posent les classes utilisées ici : `em-bg` (fond de page),
 * `em-card` (carte), `em-band` (bandeaux gris), `em-panel` (encadrés),
 * `em-btn-a` (texte du bouton plein). Une mise en page qui ajoute un fond
 * clair doit lui donner l'une de ces classes, sinon il reste clair en mode
 * sombre.
 *
 * Sources : idem/apps/landing/public/assets/icons/logo_white.png (toute bleue)
 * et logo_dark.png (« EM » blanc), réduites à 240 px (sharp, PNG palette).
 */

export const EMAIL_LOGO = {
  light: { cid: 'logo@idem.africa', src: 'cid:logo@idem.africa', ratio: 1155 / 512 },
  dark: { cid: 'logo-dark@idem.africa', src: 'cid:logo-dark@idem.africa', ratio: 1192 / 512 },
} as const;

const LOGO_PNG_BASE64: Record<string, string> = {
  [EMAIL_LOGO.light.cid]: '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',
  [EMAIL_LOGO.dark.cid]: 'iVBORw0KGgoAAAANSUhEUgAAAPAAAABnCAMAAAAJ6D9bAAAApVBMVEVMaXH7+/sTRuT19fUUR+X5+fkPNrv////f5vb19fXj4+Pt7e3Hx8f4+Pjk5OT6+vqMjZHR0dHBwcHc3Nzf39/39/fn5+f7+/sUR+kTReITRuQTReMTR+YUR+b////////8/f8LQOUVSOYYSucWSeYGPOVZfe2+zPkUSOkEOuQ7Zuvj6fz2+P4mVeiCnfJri/ACOeSPp/TP2vsVS/ScsfWyw/eou/bwz5RBAAAAHXRSTlMA3ffC/voh/AEDb4kK7FioEzAkSxWTgM7lVHS3m1o7+hwAAAAJcEhZcwAACxMAAAsTAQCanBgAAAkRSURBVHja5Z1re6I8EIaxrRXaqqs92D3ARThZTlrR9v//tHfCMYEAAYP11fmw3WttaG/mSTKZZLKSBCZL0v2fv+83qli7e//75z5++pmZLN3/u9nvP1TR9rHf3/y7PztiWfr9vv+4u7sTDgzPNPbvv8+MGHg/PgagzZg/9n/OijjhVYczcPJ5+fj+fVBeIP54P6t+/G8/LC8Q7/+dEfDgDgZg1TwjF/8Z3MHYxWc0bv09CfDf8+nCwys6HrZ+nQ0wFU8aVmqGYOCb8+nE9K+GMqP/2WDYBQBbKPQyq3kPiHgjlskrhLMFth1Nj01bI5KleA+5haZquzYyTOv/DqyB0cCWu03fQ2FB4EdfGydELlJN4xKBNaYF0cZDbivyRQAn0oev0TZ0UTPy5XhYi5n9XQhe7gAsK1zGfEWyrPR6dfAzj+nDOs3sbwy7wck0cPaT242BFjfmfwLVTFaO8jCBDV8jx1YtLmBZll6WXPYkKdXVu/yyfEl/9Q68svSEnyfzAduOH/klC/Rc0SnyQUUmBzDgzqdjLhu9lbkU6Xk1HU/nC6kTsSItX0fj8eoZN2sHhkDLLFsYes7myy+Y4UsU2mYrMPx5q000LptojzSYIi3G8SfT5y7E0GwaP24K2uACZhhCtotC5+AXyJrv1BATwOAjbcINPHqiBndFesUvC9qPXvhHfdDUKP6ZE+0BHtEP2IBlBgRZthtuI03LiHXHNVuBH3gdDDamtStn6phoc34Xp68pU0xPD2eLK9U1tn7qZPhzyyTuDTwpd9asO0y0GS+xIs2oLnIMcNy9Vdc86Fk7to97Aqedjg085RR1ImhxwGCA7PhZw4DVj9nAk1arCjcf8LhFnQtaHDB42Q7XWUs/RJYoSd9WvFiM8JyiLgQtEBicjNB33pRT0tNZmy1kuaxaEphH1ISghQJDkIUOWdtdpRszgOH3/dX6+1ZDS2IO5xI1IWixwJj4O5uevLKo64C7rx7IoIVD1KSgBQPjQDrpxxByqYI8LLUAt4UflKD7AFuFVT+GjJifEpdn42GA20VNCboPsJvbJ+NzE5qnI7WpGicAbhM1LegewOG2MI9F7B7YLh4OuEnUJUF3BjaQl6+KMVJ19WuooZ98GlmnkHSLqAtBT/oCB3qQJi2ZwODiTepix7ZOAdwkakLQk4E8DC4243FL177QkMATbTVtEzUp6NG0H3AYRZEfJ2ejiHZh2cVaEJIPEA/8+pCr9ZXtYnKEnq3SZl1HaaR+brRAW7sqqomqURgwFCAeeN62UCQXha/SqCewgT0IwMhK99IsqzIZf6WatgcGXjSKuhA0/lzpC6xmwNmHdjkDb9nbBJiaiocAlhpFTQlaehIFbG29EnKmaU0jA+ohgBVpXi9qyJzphaBlQcCWvdOCQ2XTIUpcTHbiYYCXtaKGLPQqE/TqSZKEAeP+GmxM17CIZxwSYHKROAiwUi9qMsuBE7qCgCGw+o63lrbIzkcv091WR61hPFwrahA0GWrIwvqwgWxvjb8fZuWsK6fPgOgSqQMDy1jUk6qoS4KWxQHDNIWQE+EWX56bDFIW8vIVU68EgMwNHM+1DFETgh4/490occB4IrZVnJfGo1f8rzjiriwRu3i4eZ+MAmaLuiRoSSwwznS44S6IE7TYx/m85IeNwPD231g2a05i0MB0eJE0JAV9i3UvGhjnpT8hSxskmR1+4Bpr3iejgVmiJgW9SF+LWGDYYQo3frxCMkhJtwLXJN9XcoOPS8CliEqhBf2WfJNYYOjEaBtvm37HhFayiGztw/WmN23+loHLoqYEne/QigOGYdpOhum1Z8eAxbTUc+dhoj13AC4FkUpV0EKBYcDyvpKJGKUTsZUFHuQTum21dAIuiZoQ9EP2LSIDj2R89jeqnUWXprtLgA/NsXR9H27cQakCkyIevRR/nxeHSoSFlijeNAyoQ0sGWifAm+ZYmvuYQxswFvU4F/Vj9vDpgnwlooBh8aBDjEWcxIsTl3o5jccEnoxYtnqQ+QOPjPixEE1F0AKBLeQEa4deEFtpMp5OarEjreXTr6q1VO6xgAtRs7O3RwBbpp0ApweHUajadJYn78Lrnkm8lhNYLGB4TCbqfCd1STz7CGCEkiTeJxyXjucg1SgntbI8LdmF6xcPcsU6rJbI9eAbvYc0o99HX2DTczy8vI88z0niqPI35U+gMjwDLQ9JJKVh47gvMEcivhijo0G3Wio7LPmJNVbG5wjgIDmfpOs1wFa+f7hxrVMCk6Ku5PQG9HDq4PLGwwmAIYpOP6pmbY8AJs6WsrZa0nwWDrPoT08BLC3j84WwZngqPbf/oGWFhTGOn8VHAJJJuHTK4wTAOG17iyOsxzLvcdNSTV0Tuc1SdfBJgHFWbzF7fqke/TkCuLFOK985LPfgEwGn5+QVxj5T/9Cy6Wzap6PlQ7Sp/gAwLodgJT2HAQbe7BDxWh362FKn08ODABvAG2SCrpxLuzxgyHxs8xPEjCPTFwYMiS31kJ+K3zEm6IsCxifEvSjn/WY1vCBgy8w2HpJ2X9UV1OUAG5Z5h9w4CU/wWuoFAFfrlvDpUijkUb24jierXDogdnVa3+PDPwVsoE+3bJDK8pxDpBNlS/qmrhpP9AHxgYFhmbTb0Lbbfa/99ERW5l7fcetK5GtKAJ5brLYEYGDg2nLavNoSf/2uLcTrX8YzrynyGBoYzl4Ful5bUaunxaWm2g2Yo4znlV3G81MeLiqmt5CuNVRVtIfrCrV+VtJQE2+6qsVZEn9U7eHPSjr5lfxdfOsB96UHQootuwIrYjwc+F8bz3ThLo8O11rE5bTaceW0xeY+b7nlPG02452WDruSbTaOE1o2vsXD6nRxCZxnWB1bMB1vpXQCnhWntnhuamEFHhB5IO7LaeiS+OWcryJ+PH1USmMWLokfZ7XtUgdRP0BF/Ph2gR9H162w7+KphpZmpxuZKpceLLjsiXUOWlkulkrXKBzfebBYSrLMe9uS0OuljrvWQm7fYmSqOv/BP3Gf1lEXlyjdb/FImqVx6tXdmHZ1d+Jd3a2HV3ev5dXdXHp1d9Ne3+3D13a/9PXdID7sHfHmGd4RP9j/AnBzjv8LwH8FvzFHnpqW4QAAAABJRU5ErkJggg==',
};

/**
 * Le logo, dans ses deux déclinaisons. La version sombre est masquée par
 * défaut et invisible pour Outlook Windows (commentaire conditionnel), qui
 * ignore display:none sur une image.
 */
export function emailLogoHtml(width: number, extraStyle = ''): string {
  const base = `width:${width}px;height:auto;border:0;outline:none;text-decoration:none;${extraStyle}`;
  const h = (ratio: number) => Math.round(width / ratio);
  return (
    `<img class='em-logo-light' src='${EMAIL_LOGO.light.src}' alt='IDEM' width='${width}' height='${h(EMAIL_LOGO.light.ratio)}' style='display:block;${base}'>` +
    `<!--[if !mso]><!--><img class='em-logo-dark' src='${EMAIL_LOGO.dark.src}' alt='IDEM' width='${width}' height='${h(EMAIL_LOGO.dark.ratio)}' style='display:none;max-height:0;overflow:hidden;${base}'><!--<![endif]-->`
  );
}

/** À placer dans le <head> de chaque e-mail : déclare les deux thèmes et la bascule. */
export const EMAIL_THEME_HEAD = `<meta name='color-scheme' content='light dark'>
<meta name='supported-color-schemes' content='light dark'>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .em-logo-light { display: none !important; }
    .em-logo-dark { display: block !important; max-height: none !important; }
    body, .em-bg { background: #06080d !important; }
    .em-card, .em-head { background: #0f141c !important; box-shadow: none !important; border-color: #1f2937 !important; }
    .em-band { background: #0b1017 !important; border-color: #1f2937 !important; }
    .em-panel { background: #151c27 !important; border-color: #1f2937 !important; }
    .em-card h1, .em-card p, .em-card td, .em-card div, .em-card li, .em-card span { color: #e5e7eb !important; }
    .em-card a { color: #8fb0ff !important; }
    .em-card a.em-btn-a { color: #ffffff !important; }
    .em-card table { border-color: #1f2937 !important; }
  }
  /* Outlook.com assombrit lui-même les fonds : seul le logo doit changer. */
  [data-ogsc] .em-logo-light { display: none !important; }
  [data-ogsc] .em-logo-dark { display: block !important; max-height: none !important; }
</style>`;

export interface InlineImageAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
  contentDisposition: 'inline';
}

/** Pièces jointes à ajouter à un message : les logos que son HTML référence. */
export function emailLogoAttachments(html: string | undefined): InlineImageAttachment[] {
  if (!html) return [];
  return Object.entries(LOGO_PNG_BASE64)
    .filter(([cid]) => html.includes(`cid:${cid}`))
    .map(([cid, base64]) => ({
      filename: cid.startsWith('logo-dark') ? 'idem-logo-dark.png' : 'idem-logo.png',
      content: Buffer.from(base64, 'base64'),
      contentType: 'image/png',
      cid,
      contentDisposition: 'inline' as const,
    }));
}
