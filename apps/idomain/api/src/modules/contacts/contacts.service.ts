/**
 * Le titulaire : les coordonnées que les registres exigent pour enregistrer un domaine à son nom.
 * Demandées une fois, avant le premier achat, puis réutilisées (modifiables).
 */
import { z } from 'zod';
import { one, query, withTransaction } from '../../config/db';
import { audit } from '../audit/audit.service';
import { RegistrantContact } from '../../integrations/registrars';

export const contactInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  company: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().max(254),
  phoneCountryCode: z.string().trim().regex(/^\+?\d{1,4}$/, 'Indicatif du pays (ex. 237)'),
  phone: z.string().trim().regex(/^[\d\s.-]{6,20}$/, 'Numéro de téléphone'),
  address: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().max(80).optional().nullable(),
  postalCode: z.string().trim().max(16).optional().nullable(),
  country: z.string().trim().length(2).transform((c) => c.toUpperCase()),
});

export type ContactInput = z.infer<typeof contactInput>;

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  email: string;
  phone_country_code: string;
  phone: string;
  address: string;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
}

export interface Contact extends RegistrantContact {
  id: string;
}

const toContact = (r: ContactRow): Contact => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  company: r.company,
  email: r.email,
  phoneCountryCode: r.phone_country_code,
  phone: r.phone,
  address: r.address,
  city: r.city,
  state: r.state,
  postalCode: r.postal_code,
  country: r.country,
});

export async function defaultContact(ownerUid: string): Promise<Contact | null> {
  const row = await one<ContactRow>(`SELECT * FROM domain_contacts WHERE owner_uid = $1 AND is_default`, [ownerUid]);
  return row ? toContact(row) : null;
}

export async function contactById(id: string): Promise<Contact | null> {
  const row = await one<ContactRow>(`SELECT * FROM domain_contacts WHERE id = $1`, [id]);
  return row ? toContact(row) : null;
}

/**
 * Enregistre les coordonnées par défaut. Elles servent aux PROCHAINS enregistrements : un domaine
 * déjà enregistré garde le titulaire de son enregistrement (on n'écrase pas une ligne utilisée).
 */
export async function saveDefaultContact(ownerUid: string, input: ContactInput): Promise<Contact> {
  const values = [
    input.firstName,
    input.lastName,
    input.company || null,
    input.email,
    input.phoneCountryCode.replace(/\D/g, ''),
    input.phone.replace(/\D/g, ''),
    input.address,
    input.city,
    input.state || null,
    input.postalCode || null,
    input.country,
  ];
  return withTransaction(async (client) => {
    const current = await one<{ id: string; used: boolean }>(
      `SELECT c.id, EXISTS (SELECT 1 FROM domains d WHERE d.contact_id = c.id) AS used FROM domain_contacts c WHERE c.owner_uid = $1 AND c.is_default FOR UPDATE`,
      [ownerUid],
      client
    );
    let row: ContactRow | null;
    if (current && !current.used) {
      row = await one<ContactRow>(
        `UPDATE domain_contacts SET first_name = $2, last_name = $3, company = $4, email = $5, phone_country_code = $6, phone = $7, address = $8, city = $9, state = $10, postal_code = $11, country = $12, updated_at = now()
          WHERE id = $1 RETURNING *`,
        [current.id, ...values],
        client
      );
    } else {
      if (current) await client.query(`UPDATE domain_contacts SET is_default = false WHERE id = $1`, [current.id]);
      row = await one<ContactRow>(
        `INSERT INTO domain_contacts (owner_uid, first_name, last_name, company, email, phone_country_code, phone, address, city, state, postal_code, country)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [ownerUid, ...values],
        client
      );
    }
    await audit({ actorKind: 'user', actorId: ownerUid, action: 'contact.saved', targetType: 'contact', targetId: row!.id }, client);
    return toContact(row!);
  });
}

export async function listContacts(ownerUid: string): Promise<Contact[]> {
  const rows = await query<ContactRow>(`SELECT * FROM domain_contacts WHERE owner_uid = $1 ORDER BY is_default DESC, created_at DESC`, [ownerUid]);
  return rows.map(toContact);
}
