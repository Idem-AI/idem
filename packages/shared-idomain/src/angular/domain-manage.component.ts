import { ChangeDetectionStrategy, Component, OnInit, input, output, signal } from '@angular/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Connection, IdomainError, RecordSet, createIdomainClient } from '../client';
import { formatXaf } from '../flow';
import { idomainText } from '../texts';

const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA', 'SRV'];

/**
 * Les noms achetés chez IDEM et reliés à cette application, gérés sur place : état, échéance,
 * renouvellement, débranchement, et la vue avancée des DNS (un jeu à la fois — modifier une ligne
 * ne touche jamais le courrier ni les autres réglages). N'affiche rien s'il n'y en a pas.
 */
@Component({
  selector: 'idem-domain-manage',
  imports: [IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (connections().length) {
      <section class="glass-card overflow-hidden">
        <header class="px-5 py-4" style="border-bottom: 1px solid var(--glass-border-subtle)">
          <h2 class="font-semibold">{{ t('manage.title') }}</h2>
        </header>
        <ul>
          @for (c of connections(); track c.id; let last = $last) {
            <li class="px-5 py-4" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="c.status === 'active' ? 'var(--color-success)' : c.status === 'failed' ? 'var(--color-warning)' : 'var(--color-text-tertiary)'" aria-hidden="true"></span>
                <div class="min-w-0 flex-1">
                  <a class="break-all font-mono text-sm font-semibold hover:underline" [href]="'https://' + c.host" target="_blank" rel="noopener noreferrer">{{ c.host }}</a>
                  <p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    {{ t('manage.status.' + (c.status === 'active' ? 'active' : c.status === 'failed' ? 'failed' : 'pending')) }}
                    @if (c.domain?.expiresAt) { · {{ t('manage.expires', { date: date(c.domain!.expiresAt!) }) }} }
                    @if (c.domain?.renewalXaf) { · {{ t('manage.renewal', { price: xaf(c.domain!.renewalXaf) }) }} }
                  </p>
                </div>
                @if (c.status === 'failed') {
                  <button type="button" class="outer-button button-sm" [disabled]="busy() === c.id" (click)="retry(c)">{{ t('progress.retry') }}</button>
                }
                @if (c.domain?.dnsManaged) {
                  <button type="button" class="button-ghost button-sm" [attr.aria-expanded]="openDns() === c.id" (click)="toggleDns(c)">{{ t('manage.dns') }}</button>
                }
                <button type="button" class="button-ghost button-sm" style="color: var(--color-danger)" [disabled]="busy() === c.id" (click)="detach(c)">{{ t('manage.detach') }}</button>
              </div>

              @if (openDns() === c.id) {
                <div class="mt-4 rounded-xl border border-[var(--glass-border-subtle)] p-4">
                  @if (records() === null) {
                    <idem-loader block />
                  } @else {
                    <ul class="space-y-1 text-xs">
                      @for (r of records(); track r.name + r.type) {
                        <li class="flex flex-wrap items-start gap-2">
                          <span class="w-20 font-mono">{{ r.name }}</span>
                          <span class="w-12">{{ r.type }}</span>
                          <span class="min-w-0 flex-1 break-all font-mono">{{ r.values.join(' · ') }}</span>
                          <button type="button" class="button-ghost button-sm" (click)="edit(r)"><i class="pi pi-pencil text-xs" aria-hidden="true"></i><span class="sr-only">{{ r.name }} {{ r.type }}</span></button>
                        </li>
                      }
                    </ul>
                    <form class="mt-4 grid gap-2 sm:grid-cols-[100px_100px_1fr_auto]" (submit)="$event.preventDefault(); saveRecord(c, nameInput.value, typeInput.value, valuesInput.value)">
                      <label class="sr-only" for="dns-n">Nom</label>
                      <input #nameInput id="dns-n" type="text" placeholder="@" [value]="draft().name" autocapitalize="none" spellcheck="false" />
                      <label class="sr-only" for="dns-t">Type</label>
                      <select #typeInput id="dns-t">
                        @for (ty of types; track ty) { <option [value]="ty" [selected]="ty === draft().type">{{ ty }}</option> }
                      </select>
                      <label class="sr-only" for="dns-v">Valeurs</label>
                      <input #valuesInput id="dns-v" type="text" placeholder="valeur1, valeur2" [value]="draft().values" spellcheck="false" />
                      <button type="submit" class="outer-button button-sm" [disabled]="busy() === 'dns'">@if (busy() === 'dns') { <idem-loader size="xs" /> }OK</button>
                    </form>
                  }
                </div>
              }
            </li>
          }
        </ul>
        @if (error()) { <p class="px-5 pb-4 text-sm" role="alert" style="color: var(--color-danger)">{{ error() }}</p> }
      </section>
    }
  `,
})
export class DomainManageComponent implements OnInit {
  readonly apiUrl = input.required<string>();
  readonly appUuid = input.required<string>();
  readonly lang = input('fr');
  /** Un nom a été débranché ou relancé : l'écran hôte relit ses adresses. */
  readonly changed = output<void>();

  protected readonly connections = signal<Connection[]>([]);
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly openDns = signal<string | null>(null);
  protected readonly records = signal<RecordSet[] | null>(null);
  protected readonly draft = signal<{ name: string; type: string; values: string }>({ name: '@', type: 'TXT', values: '' });
  protected readonly types = DNS_TYPES;
  private client!: ReturnType<typeof createIdomainClient>;

  ngOnInit(): void {
    this.client = createIdomainClient(this.apiUrl(), () => this.lang());
    this.reload();
  }

  /** Relire la liste (appelé aussi par l'écran hôte après un achat). */
  reload(): void {
    this.client
      .connections({ appUuid: this.appUuid() })
      .then((r) => this.connections.set(r.connections.filter((c) => c.domain)))
      .catch(() => this.connections.set([]));
  }

  protected t(key: string, params: Record<string, string | number> = {}): string {
    return idomainText(this.lang(), key, params);
  }

  protected xaf(v: number | null): string {
    return formatXaf(v);
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString(this.lang().startsWith('en') ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  private async act(id: string, fn: () => Promise<unknown>): Promise<void> {
    this.busy.set(id);
    this.error.set(null);
    try {
      await fn();
      this.reload();
      this.changed.emit();
    } catch (e) {
      this.error.set(e instanceof IdomainError && e.message ? e.message : this.t('errors.retry'));
    } finally {
      this.busy.set(null);
    }
  }

  protected retry(c: Connection): void {
    void this.act(c.id, () => this.client.retryConnection(c.id));
  }

  protected detach(c: Connection): void {
    if (!confirm(this.t('manage.confirmDetach', { domain: c.host }))) return;
    void this.act(c.id, () => this.client.detach(c.id));
  }

  protected toggleDns(c: Connection): void {
    if (this.openDns() === c.id) {
      this.openDns.set(null);
      return;
    }
    this.openDns.set(c.id);
    this.records.set(null);
    this.client
      .records(c.domain!.id)
      .then((r) => this.records.set(r.records))
      .catch((e) => {
        this.records.set([]);
        this.error.set(e instanceof IdomainError && e.message ? e.message : this.t('errors.retry'));
      });
  }

  protected edit(r: RecordSet): void {
    this.draft.set({ name: r.name, type: r.type, values: r.values.join(', ') });
  }

  protected saveRecord(c: Connection, name: string, type: string, values: string): void {
    const list = values.split(',').map((v) => v.trim()).filter(Boolean);
    this.busy.set('dns');
    this.error.set(null);
    this.client
      .saveRecordSet(c.domain!.id, { name: name.trim() || '@', type, ttl: 3600, values: list })
      .then((r) => {
        this.records.set(r.records);
        this.draft.set({ name: '@', type: 'TXT', values: '' });
      })
      .catch((e) => this.error.set(e instanceof IdomainError && e.message ? e.message : this.t('errors.retry')))
      .finally(() => this.busy.set(null));
  }
}
