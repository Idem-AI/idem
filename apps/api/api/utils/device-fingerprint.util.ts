import { Request } from 'express';

/**
 * Empreinte d'appareil d'une session.
 *
 * Une session est liée à l'appareil qui l'a ouverte : système, navigateur et
 * format (mobile, tablette, ordinateur), lus dans le User-Agent. Volontairement
 * grossière :
 *
 *  - **ni version ni IP** : une mise à jour du navigateur ou un changement de
 *    réseau (4G → Wi-Fi, NAT des opérateurs mobiles) ne doivent pas passer pour
 *    un autre appareil ;
 *  - **lisible** (`android/chrome/mobile`) : elle figure dans les journaux et
 *    dans l'e-mail d'alerte, elle ne protège rien par elle-même.
 *
 * Le User-Agent est déclaré par le client : l'empreinte arrête le rejeu d'un
 * cookie volé depuis un autre appareil, pas un attaquant qui recopie aussi le
 * User-Agent de sa victime.
 */

/**
 * En-tête par lequel un serveur satellite (AppGen, iVision, iDomain, iDeploy)
 * transmet le User-Agent du navigateur dont il relaie le cookie. Sans lui,
 * l'API verrait celui d'axios ou de fetch et croirait à un autre appareil.
 * Lui faire confiance n'ouvre rien : le User-Agent est de toute façon déclaré
 * par le client.
 */
export const CLIENT_UA_HEADER = 'x-idem-client-user-agent';

/** User-Agent du navigateur à l'origine de la requête. */
export function clientUserAgent(req: Request): string {
  const forwarded = req.get(CLIENT_UA_HEADER);
  return (forwarded || req.get('user-agent') || '').slice(0, 512);
}

function osOf(ua: string): string {
  if (/iPhone|iPod/.test(ua)) return 'ios';
  if (/iPad/.test(ua)) return 'ipados';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/.test(ua)) return 'macos';
  if (/Linux/.test(ua)) return 'linux';
  return 'other';
}

function browserOf(ua: string): string {
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'edge';
  if (/OPR\/|Opera/.test(ua)) return 'opera';
  if (/SamsungBrowser\//.test(ua)) return 'samsung';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'firefox';
  if (/CriOS\/|Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'safari';
  // Client HTTP (axios/1.7, curl/8…) : son nom, sans la version.
  const product = /^([A-Za-z][\w.-]*)\//.exec(ua)?.[1];
  return product ? product.toLowerCase() : 'other';
}

function formOf(ua: string): string {
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'tablet';
  if (/Mobi|iPhone|iPod/.test(ua)) return 'mobile';
  return 'desktop';
}

/** `android/chrome/mobile`, ou `unknown` sans User-Agent. */
export function deviceFingerprint(userAgent: string | undefined): string {
  const ua = (userAgent ?? '').trim();
  if (!ua || ua === 'Unknown device') return 'unknown';
  return `${osOf(ua)}/${browserOf(ua)}/${formOf(ua)}`;
}

const OS_LABELS: Record<string, string> = {
  ios: 'iPhone',
  ipados: 'iPad',
  android: 'Android',
  chromeos: 'ChromeOS',
  windows: 'Windows',
  macos: 'Mac',
  linux: 'Linux',
};

const BROWSER_LABELS: Record<string, string> = {
  edge: 'Edge',
  opera: 'Opera',
  samsung: 'Samsung Internet',
  firefox: 'Firefox',
  chrome: 'Chrome',
  safari: 'Safari',
  other: 'Navigateur non identifié',
};

/** « Chrome sur Android », pour l'e-mail d'alerte. */
export function describeDevice(fingerprint: string): string {
  if (fingerprint === 'unknown') return 'Appareil non identifié';
  const [os, browser] = fingerprint.split('/');
  const browserLabel = BROWSER_LABELS[browser] ?? browser;
  const osLabel = OS_LABELS[os];
  return osLabel ? `${browserLabel} sur ${osLabel}` : browserLabel;
}
