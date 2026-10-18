/**
 * `npm run check:embedded` — le parcours d'achat intégré à iDeploy et iCode (`@idem/shared-idomain`),
 * joué contre une API iDomain réelle en mode hors ligne (`npm run dev:offline` déjà lancé).
 *
 * Il prouve que, sans quitter l'application hôte : la recherche donne un prix, le titulaire est
 * demandé une fois, le paiement part du portefeuille, et le nom finit enregistré, écrit dans la
 * zone, relié à l'application et en ligne — sans aucun réglage de l'utilisateur.
 */
import assert from 'node:assert/strict';
import { createIdomainClient } from '../../../../packages/shared-idomain/src/client';
import { DomainPurchaseFlow, PurchaseState } from '../../../../packages/shared-idomain/src/flow';

const API = process.env.IDOMAIN_CHECK_API || 'http://localhost:3007';
// Hors navigateur, le cookie de session IDEM (simulé : `good`) est ajouté à la main.
const withSession: typeof fetch = (input, init = {}) => fetch(input, { ...init, headers: { ...(init.headers as Record<string, string>), Cookie: 'session=good' } });

function waitFor(flow: DomainPurchaseFlow, test: (s: PurchaseState) => boolean, label: string, timeoutMs = 90_000): Promise<PurchaseState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`délai dépassé : ${label} (état ${JSON.stringify({ step: flow.state.step, progress: flow.state.progress, error: flow.state.error })})`)), timeoutMs);
    const off = flow.subscribe((s) => {
      if (test(s)) {
        clearTimeout(timer);
        setTimeout(() => off());
        resolve(s);
      }
    });
  });
}

async function main(): Promise<void> {
  const name = `atelier-${Date.now().toString(36)}`;
  const flow = new DomainPurchaseFlow(createIdomainClient(API, () => 'fr', withSession), { appUuid: 'app-demo' });
  console.log('Parcours intégré (iDeploy, iCode)');

  await flow.search(name);
  const exact = flow.state.result?.exact;
  assert.equal(exact?.state, 'available');
  assert.ok((exact?.priceXaf ?? 0) > 0 && exact?.renewalXaf);
  console.log(`  ✓ recherche : ${exact!.domain} à ${exact!.priceXaf} F, renouvellement ${exact!.renewalXaf} F`);

  await flow.choose(exact!);
  if (flow.state.step === 'holder') {
    await flow.saveContact({ firstName: 'Awa', lastName: 'Ndiaye', email: 'awa@example.com', phoneCountryCode: '237', phone: '699000000', address: 'Rue 1.234, Bonapriso', city: 'Douala', country: 'cm' });
    console.log('  ✓ titulaire demandé une fois, enregistré');
  }
  assert.equal(flow.state.step, 'confirm');
  assert.ok(flow.state.session?.id);
  console.log('  ✓ prix garanti, application déjà choisie (aucune question)');

  await flow.pay();
  assert.equal(flow.state.step, 'progress');
  console.log('  ✓ payé depuis le portefeuille');

  const live = await waitFor(flow, (s) => s.progress === 'live' || s.progress === 'failed' || s.progress === 'connection_failed', 'mise en ligne');
  assert.equal(live.progress, 'live');
  assert.equal(live.connection?.host, exact!.domain);
  assert.equal(live.connection?.status, 'active');
  assert.ok(live.connection?.domain?.expiresAt);
  console.log(`  ✓ enregistré, DNS écrits, relié à l'application, en ligne : https://${live.connection!.host}`);

  const list = await createIdomainClient(API, () => 'fr', withSession).connections({ appUuid: 'app-demo' });
  assert.ok(list.connections.some((c) => c.host === exact!.domain && c.domain?.renewalXaf));
  console.log('  ✓ gestion sur place : échéance et renouvellement lisibles depuis l’application');
  flow.dispose();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
