/**
 * LE TIRAGE DE L'AXE DE DÉPART — déterministe (même demande, même sel → même axe), jamais deux fois le même pour une
 * marque tant qu'il en reste d'autres.
 *
 * Le pays de la marque connu : un axe culturel de CE pays une fois sur deux, sinon un axe de forme ; inconnu : tout
 * le répertoire. Ce qui a déjà servi à la marque (`used`) est écarté ; tout servi, le plus ancien revient.
 */
import { ALL_AXES, COUNTRIES, CountryCode, CULTURAL_AXES, FORM_AXES, reviewedCountries, StartAxis } from './axes';
import { hashString, seededRandom } from '../tool';

export * from './axes';

export interface AxisRequest {
  /** La graine : la demande, le livrable, la marque (le même document refait garde son axe). */
  seed: string;
  /** Le pays de la marque (code ISO alpha-3, ou alpha-2 : il est converti). */
  country?: string;
  /** Les axes déjà servis à cette marque, du plus ancien au plus récent. */
  used?: string[];
  /** Le support : la vidéo admet les axes de mouvement, le document non. */
  medium: 'video' | 'document';
}

const ALPHA2: Record<string, CountryCode> = { BJ: 'BEN', CI: 'CIV', CM: 'CMR', CD: 'COD', CG: 'COG', GA: 'GAB', KE: 'KEN', MZ: 'MOZ', RW: 'RWA', SN: 'SEN', SL: 'SLE', UG: 'UGA', ZM: 'ZMB' };

/** Les noms usuels (français, anglais, portugais), sans accents ni casse. */
const NAMES: Record<string, CountryCode> = {
  benin: 'BEN', 'cote d ivoire': 'CIV', 'ivory coast': 'CIV', cameroun: 'CMR', cameroon: 'CMR', 'rd congo': 'COD', rdc: 'COD', 'republique democratique du congo': 'COD', 'democratic republic of the congo': 'COD', 'congo kinshasa': 'COD', congo: 'COG', 'republique du congo': 'COG', 'congo brazzaville': 'COG', gabon: 'GAB', kenya: 'KEN', mozambique: 'MOZ', mocambique: 'MOZ', rwanda: 'RWA', senegal: 'SEN', 'sierra leone': 'SLE', ouganda: 'UGA', uganda: 'UGA', zambie: 'ZMB', zambia: 'ZMB',
};

export function countryCode(value?: string): CountryCode | undefined {
  const v = (value || '').trim().toUpperCase();
  if ((COUNTRIES as string[]).includes(v)) return v as CountryCode;
  if (ALPHA2[v]) return ALPHA2[v];
  const name = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, ' ').trim();
  return NAMES[name];
}

function eligible(medium: AxisRequest['medium']): StartAxis[] {
  const reviewedOnly = process.env.IDEM_AXES_REVIEWED_ONLY === '1' && reviewedCountries().size === COUNTRIES.length;
  const cultural = CULTURAL_AXES.filter((a) => !reviewedOnly || a.review?.status === 'reviewed');
  const form = FORM_AXES.filter((a) => medium === 'video' || a.kind !== 'motion');
  return [...cultural, ...form];
}

export function pickAxis(req: AxisRequest): StartAxis {
  const pool = eligible(req.medium);
  const country = countryCode(req.country);
  const rand = seededRandom(hashString(`${req.seed}|${country ?? ''}`));
  const used = req.used ?? [];
  const fresh = (list: StartAxis[]) => list.filter((a) => !used.includes(a.id));
  const local = country ? pool.filter((a) => a.country === country) : [];
  const form = pool.filter((a) => !a.country);
  // Le pays connu : une chance sur deux pour sa culture ; sinon une forme ; inconnu : tout le répertoire.
  const preferLocal = local.length > 0 && rand() < 0.5;
  const candidates = preferLocal ? fresh(local) : country ? fresh(form) : fresh(pool);
  const list = candidates.length ? candidates : fresh(pool);
  if (list.length) return list[Math.floor(rand() * list.length)];
  // Tout a servi : le plus anciennement servi revient.
  const oldest = used.find((id) => pool.some((a) => a.id === id));
  return pool.find((a) => a.id === oldest) ?? ALL_AXES[0];
}

/** La ligne donnée au directeur (consigne en anglais). */
export function axisLine(axis: StartAxis, medium: AxisRequest['medium']): string {
  const motion = medium === 'video' && axis.motion ? ` In motion: ${axis.motion}.` : '';
  const cultural = axis.country ? ' Take the visual PRINCIPLE only (material, geometry, rhythm): never reproduce the object, never name it on screen, never claim its meaning.' : '';
  return `STARTING POINT (drawn by the code to move away from the obvious idea — interpret it freely, it is not a template): ${axis.principle}.${motion}${cultural}`;
}
