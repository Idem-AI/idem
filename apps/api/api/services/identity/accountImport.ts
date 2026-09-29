import mongoose from 'mongoose';
import { SupabaseUser, supabaseAdmin } from './supabaseAuth.client';

/**
 * Reprise des comptes IDEM existants dans le serveur d'authentification.
 * Voir `api/scripts/importAuthAccounts.ts` pour le principe et l'usage.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AccountImportReport {
  scanned: number;
  created: number;
  attachedExisting: number;
  alreadyLinked: number;
  invalidEmail: string[];
  duplicateEmail: string[];
  conflicts: string[];
  failed: string[];
}

/** Tous les comptes Supabase existants, indexés par adresse. */
async function loadExistingAuthUsers(): Promise<Map<string, SupabaseUser>> {
  const byEmail = new Map<string, SupabaseUser>();
  for (let page = 1; ; page += 1) {
    const users = await supabaseAdmin.listUsers(page, 500);
    for (const user of users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user);
    }
    if (users.length < 500) break;
  }
  return byEmail;
}

/**
 * Crée (ou rattache) un compte d'authentification pour chaque utilisateur
 * IDEM qui n'en a pas. Sans `apply`, compte seulement.
 */
export async function importAuthAccounts(apply: boolean): Promise<AccountImportReport> {
  const users = mongoose.connection.collection('users');
  const existing = await loadExistingAuthUsers();

  const report: AccountImportReport = {
    scanned: 0,
    created: 0,
    attachedExisting: 0,
    alreadyLinked: 0,
    invalidEmail: [],
    duplicateEmail: [],
    conflicts: [],
    failed: [],
  };
  const seenEmails = new Set<string>();

  const cursor = users.find(
    {},
    { projection: { _id: 1, email: 1, displayName: 1, photoURL: 1, authId: 1 } }
  );

  for await (const doc of cursor) {
    report.scanned += 1;
    const uid = String(doc._id);

    if (doc.authId) {
      report.alreadyLinked += 1;
      continue;
    }

    const email = typeof doc.email === 'string' ? doc.email.trim().toLowerCase() : '';
    if (!EMAIL_PATTERN.test(email)) {
      report.invalidEmail.push(uid);
      continue;
    }
    if (seenEmails.has(email)) {
      // Deux documents IDEM pour la même adresse (casse différente) : à trancher à la main.
      report.duplicateEmail.push(`${uid} <${email}>`);
      continue;
    }
    seenEmails.add(email);

    const current = existing.get(email);
    if (current) {
      const importedUid = current.app_metadata?.idem_uid;
      if (importedUid && importedUid !== uid) {
        report.conflicts.push(`${uid} <${email}> déjà réservé pour ${importedUid}`);
        continue;
      }
      const taken = await users.findOne({ authId: current.id, _id: { $ne: uid as any } });
      if (taken) {
        report.conflicts.push(`${uid} <${email}> : compte d'authentification lié à ${taken._id}`);
        continue;
      }
      report.attachedExisting += 1;
      if (!apply) continue;
      try {
        if (!importedUid) {
          await supabaseAdmin.updateUser(current.id, {
            app_metadata: { ...(current.app_metadata ?? {}), idem_uid: uid },
          });
        }
        await users.updateOne(
          { _id: uid as any, authId: { $exists: false } },
          { $set: { authId: current.id, 'authMigration.importedAt': new Date() } }
        );
      } catch (error: any) {
        report.failed.push(`${uid} <${email}> : ${error.response?.data?.msg ?? error.message}`);
      }
      continue;
    }

    report.created += 1;
    if (!apply) continue;
    try {
      const created = await supabaseAdmin.createUser({
        email,
        email_confirm: true,
        role: 'authenticated',
        app_metadata: { idem_uid: uid },
        user_metadata: {
          ...(doc.displayName && { full_name: doc.displayName }),
          ...(doc.photoURL && { avatar_url: doc.photoURL }),
        },
      });
      await users.updateOne(
        { _id: uid as any, authId: { $exists: false } },
        { $set: { authId: created.id, 'authMigration.importedAt': new Date() } }
      );
      existing.set(email, created);
    } catch (error: any) {
      report.failed.push(`${uid} <${email}> : ${error.response?.data?.msg ?? error.message}`);
    }
  }

  return report;
}
