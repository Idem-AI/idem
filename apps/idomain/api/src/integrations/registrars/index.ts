/**
 * Le registre des connecteurs. Un fournisseur n'est interrogé que s'il est À LA FOIS activé en
 * base (`registrar_providers.enabled`, réglé depuis la console) et configuré (ses identifiants
 * sont dans Infisical). Openprovider et Clouder s'ajoutent ici, derrière la même interface.
 */
import { env } from '../../config/env';
import { DomainNameApiAdapter } from './domainnameapi';
import { SimulatedRegistrar } from './simulated';
import { RegistrarAdapter } from './types';

let adapters: Map<string, RegistrarAdapter> | null = null;

function build(): Map<string, RegistrarAdapter> {
  const list: RegistrarAdapter[] = [new DomainNameApiAdapter()];
  if (env.simulatedRegistrar) list.push(new SimulatedRegistrar());
  return new Map(list.map((a) => [a.code, a]));
}

export function registrar(code: string): RegistrarAdapter | null {
  adapters ??= build();
  const adapter = adapters.get(code);
  return adapter && adapter.isConfigured() ? adapter : null;
}

export function configuredRegistrars(): RegistrarAdapter[] {
  adapters ??= build();
  return [...adapters.values()].filter((a) => a.isConfigured());
}

/** Pour les contrôles : remplacer un connecteur (fournisseur en panne, lent…). */
export function overrideRegistrar(adapter: RegistrarAdapter): void {
  adapters ??= build();
  adapters.set(adapter.code, adapter);
}

export * from './types';
