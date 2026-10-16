import { decryptValue, encryptValue, hashValue } from '../../utils/crypto.util';

/** Chiffres seuls, format international sans « + » (c'est la forme que WhatsApp envoie). */
export function normalizePhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export const phoneHash = (digits: string): string => hashValue(`wa:${digits}`);
export const phoneEnc = (digits: string, userId: string): string => encryptValue(digits, `wa:${userId}`);
export const phoneDec = (payload: string, userId: string): string | null => decryptValue(payload, `wa:${userId}`);

/** « 237 6•• •• •• 12 » : pour l'écran et les journaux, jamais le numéro entier. */
export function maskPhone(digits: string): string {
  return digits.length <= 4 ? '••••' : `••••${digits.slice(-4)}`;
}
