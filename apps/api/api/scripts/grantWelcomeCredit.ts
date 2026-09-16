/**
 * Crédit de bienvenue des comptes existants — `npm run grant:welcome`.
 *
 * Jusqu'ici, chaque compte disposait de 50 générations par jour. Le modèle
 * économique donne 5 crédits iBusiness par mois au plan gratuit : basculer
 * d'un jour à l'autre couperait l'accès de gens qui n'ont rien demandé, et le
 * feraient savoir.
 *
 * Ce script accorde donc **une fois** 50 crédits iBusiness et 50 crédits iCode,
 * valables deux mois — de quoi terminer un livrable en cours et découvrir le
 * barème sans se sentir puni.
 *
 * Deux garde-fous :
 *  - **simulation par défaut** : sans `--apply`, il compte et n'écrit rien ;
 *  - **idempotent** : un compte ayant déjà reçu son crédit (raison
 *    `welcome_grant`) est ignoré, donc le script peut être rejoué sans
 *    distribuer deux fois.
 *
 *   npx ts-node --transpile-only api/scripts/grantWelcomeCredit.ts          # simulation
 *   npx ts-node --transpile-only api/scripts/grantWelcomeCredit.ts --apply  # exécution
 */

import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import { User } from '../schemas/user.schema';
import { BillingSubscription, CreditLedgerEntry } from '../schemas/billing.schema';
import { billingSettingsService } from '../services/billing/billing-settings.service';
import { creditLedgerService } from '../services/billing/credit-ledger.service';
import { firstNameOf } from '../services/email/email-layout';
import { transactionalEmailService } from '../services/email/email.service';
import { welcomeCredit as welcomeCreditEmail } from '../services/email/templates';

const APPLY = process.argv.includes('--apply');

interface Report {
  scanned: number;
  granted: number;
  alreadyGranted: number;
  skippedBeta: number;
  failed: number;
}

async function main(): Promise<void> {
  console.log(
    APPLY
      ? 'Crédit de bienvenue — EXÉCUTION\n'
      : 'Crédit de bienvenue — simulation (ajouter --apply pour exécuter)\n'
  );

  // Même chargement de configuration que l'application (développement des
  // `${…}` compris), sans quoi la connexion MongoDB échoue.
  await loadSecrets();
  await mongoDBConnection.connect();

  const settings = await billingSettingsService.ensureExists();
  const { welcomeCredit } = settings;

  if (!welcomeCredit.enabled) {
    console.log('Le crédit de bienvenue est désactivé dans les réglages. Rien à faire.');
    await mongoDBConnection.disconnect();
    return;
  }

  console.log(
    `Montant : ${welcomeCredit.business} crédits iBusiness + ${welcomeCredit.appgen} crédits iCode, ` +
      `valables ${welcomeCredit.validityMonths} mois.\n`
  );

  const expiresAt = new Date();
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + welcomeCredit.validityMonths);

  // Les bêta-testeurs reçoivent déjà 1 500 + 1 500 crédits par mois : leur
  // ajouter 50 n'aurait aucun sens et brouillerait la mesure du programme.
  const betaUserIds = new Set(
    (
      await BillingSubscription.find({ provider: 'beta', status: { $in: ['active', 'trialing'] } })
        .select('userId')
        .lean()
    ).map((subscription) => subscription.userId)
  );

  const report: Report = {
    scanned: 0,
    granted: 0,
    alreadyGranted: 0,
    skippedBeta: 0,
    failed: 0,
  };

  // Curseur plutôt que `find()` : la base de production peut compter des
  // dizaines de milliers de comptes, et rien n'oblige à tous les charger.
  const cursor = User.find({}, { uid: 1, email: 1, displayName: 1 }).lean().cursor();

  for await (const user of cursor) {
    report.scanned += 1;

    if (betaUserIds.has(user.uid)) {
      report.skippedBeta += 1;
      continue;
    }

    const already = await CreditLedgerEntry.exists({ userId: user.uid, reason: 'welcome_grant' });
    if (already) {
      report.alreadyGranted += 1;
      continue;
    }

    if (!APPLY) {
      report.granted += 1;
      continue;
    }

    try {
      if (welcomeCredit.business > 0) {
        await creditLedgerService.grant(
          user.uid,
          'business',
          welcomeCredit.business,
          'welcome_grant',
          { note: 'Crédit de bienvenue — passage au modèle par crédits', expiresAt }
        );
      }

      if (welcomeCredit.appgen > 0) {
        await creditLedgerService.grant(
          user.uid,
          'appgen',
          welcomeCredit.appgen,
          'welcome_grant',
          { note: 'Crédit de bienvenue — passage au modèle par crédits', expiresAt }
        );
      }

      report.granted += 1;

      // L'e-mail explique le changement de fonctionnement : des crédits
      // apparus sans explication inquiètent plus qu'ils ne rassurent. Son
      // échec ne remet pas en cause l'octroi, déjà inscrit au grand livre.
      if (user.email) {
        const message = welcomeCreditEmail({
          firstName: firstNameOf(user.displayName, user.email),
          business: welcomeCredit.business,
          appgen: welcomeCredit.appgen,
          expiresAt,
        });

        await transactionalEmailService.send({
          to: user.email,
          subject: message.subject,
          html: message.html,
          text: message.text,
          template: 'billing.welcome_credit',
          relatedType: 'welcome_credit',
          userId: user.uid,
        });
      }

      if (report.granted % 100 === 0) {
        console.log(`  … ${report.granted} comptes crédités`);
      }
    } catch (error: any) {
      // Un compte en échec ne doit pas arrêter la campagne : on le signale et
      // on continue, le script étant rejouable.
      report.failed += 1;
      console.error(`  ✗ ${user.email ?? user.uid} : ${error.message}`);
    }
  }

  if (APPLY && report.granted > 0) {
    // Date de campagne : elle évite qu'un second passage soit lancé par
    // inadvertance, et documente le moment de la bascule.
    await billingSettingsService.update(
      { welcomeCredit: { ...welcomeCredit, grantedAt: new Date() } },
      'grantWelcomeCredit script'
    );
  }

  console.log('\nRésultat');
  console.log(`  Comptes parcourus       : ${report.scanned}`);
  console.log(`  ${APPLY ? 'Crédités' : 'À créditer'}${APPLY ? '                ' : '              '}: ${report.granted}`);
  console.log(`  Déjà crédités           : ${report.alreadyGranted}`);
  console.log(`  Bêta-testeurs ignorés   : ${report.skippedBeta}`);
  console.log(`  Échecs                  : ${report.failed}`);

  if (!APPLY && report.granted > 0) {
    console.log('\nRelancer avec --apply pour accorder réellement ces crédits.');
  }

  await mongoDBConnection.disconnect();
  process.exit(report.failed > 0 ? 1 : 0);
}

void main().catch(async (error) => {
  console.error('\nÉchec :', error);
  await mongoDBConnection.disconnect().catch(() => undefined);
  process.exit(1);
});
