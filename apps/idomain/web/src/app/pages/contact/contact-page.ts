import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../core/api.service';
import { Contact } from '../../core/models';
import { ContactForm } from '../../shared/components/contact-form';

/** Le titulaire des prochains domaines (ceux déjà enregistrés gardent le leur). */
@Component({
  selector: 'idm-contact-page',
  imports: [TranslateModule, IdemLoaderComponent, ContactForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl px-4 py-10">
      <h1 class="text-2xl font-semibold">{{ 'contact.title' | translate }}</h1>
      <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'contact.lead' | translate }}</p>
      <section class="glass-card mt-6 p-5">
        @if (loaded()) {
          <idm-contact-form [contact]="contact()" [defaults]="defaults()" (saved)="saved($event)" />
          @if (done()) { <p class="mt-4 text-sm text-[var(--color-success)]" role="status">{{ 'contact.saved' | translate }}</p> }
        } @else {
          <idem-loader block [label]="'common.loading' | translate" />
        }
      </section>
    </div>
  `,
})
export class ContactPage {
  protected readonly contact = signal<Contact | null>(null);
  protected readonly defaults = signal<Partial<Contact>>({});
  protected readonly loaded = signal(false);
  protected readonly done = signal(false);

  constructor() {
    inject(ApiService)
      .me()
      .subscribe({
        next: (me) => {
          this.contact.set(me.contact);
          this.defaults.set({ email: me.user.email });
          this.loaded.set(true);
        },
        error: () => this.loaded.set(true),
      });
  }

  protected saved(contact: Contact): void {
    this.contact.set(contact);
    this.done.set(true);
  }
}
