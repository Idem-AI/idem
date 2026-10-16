import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { environment } from '../../../environments/environment';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

interface ContactForm {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
}

/** Une façon de nous joindre, lisible et sélectionnable. */
interface Channel {
  label: string;
  value: string;
  detail: string;
  href?: string;
}

interface Subject {
  value: string;
  label: string;
}

interface FaqEntry {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-contact-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IdemLoaderComponent, PageArtComponent],
  templateUrl: './contact-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './contact-page.css'],
})
export class ContactPage {
  private readonly http = inject(HttpClient);

  protected readonly consoleUrl = environment.services.dashboard.url;

  protected readonly form = signal<ContactForm>({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: '',
  });

  protected readonly isSubmitting = signal(false);
  protected readonly isSubmitted = signal(false);

  /**
   * L'échec s'affiche dans la page, à côté du bouton qui vient d'être pressé.
   * Une boîte de dialogue du navigateur sort de la page, n'est pas traduite et
   * disparaît sans laisser le message en vue.
   */
  protected readonly errorMessage = signal('');

  protected readonly channels: Channel[] = [
    {
      label: $localize`:@@contact-page.channel.email.label:Email`,
      value: 'contact@idem.africa',
      href: 'mailto:contact@idem.africa',
      detail: $localize`:@@contact-page.channel.email.detail:The fastest route. A founder reads it.`,
    },
    {
      label: $localize`:@@contact-page.channel.phone.label:Phone and WhatsApp`,
      value: '+237 6 95 40 45 27',
      href: 'tel:+237695404527',
      detail: $localize`:@@contact-page.channel.phone.detail:Monday to Saturday, 9:00 to 18:00 WAT.`,
    },
    {
      label: $localize`:@@contact-page.channel.office.label:Office`,
      value: $localize`:@@contact-page.channel.office.value:Douala, Cameroon`,
      detail: $localize`:@@contact-page.channel.office.detail:Come by if you are in town — tell us first.`,
    },
    {
      label: $localize`:@@contact-page.channel.code.label:Issues and code`,
      value: 'github.com/Idem-AI',
      href: 'https://github.com/Idem-AI',
      detail: $localize`:@@contact-page.channel.code.detail:A bug or a feature request belongs here, in the open.`,
    },
  ];

  protected readonly subjects: Subject[] = [
    { value: 'general', label: $localize`:@@contact-page.subject.general:A question about IDEM` },
    { value: 'demo', label: $localize`:@@contact-page.subject.demo:A walkthrough of the platform` },
    {
      value: 'enterprise',
      label: $localize`:@@contact-page.subject.enterprise:A company deployment`,
    },
    { value: 'partnership', label: $localize`:@@contact-page.subject.partnership:A partnership` },
    { value: 'support', label: $localize`:@@contact-page.subject.support:Something is broken` },
    { value: 'billing', label: $localize`:@@contact-page.subject.billing:Billing or pricing` },
  ];

  protected readonly faqs: FaqEntry[] = [
    {
      question: $localize`:@@contact-page.faq.delay.question:How long until someone replies?`,
      answer: $localize`:@@contact-page.faq.delay.answer:One working day for a written message. If it is urgent, call the number above — it rings on a founder's phone.`,
    },
    {
      question: $localize`:@@contact-page.faq.enterprise.question:Can IDEM run inside my company?`,
      answer: $localize`:@@contact-page.faq.enterprise.answer:Yes. The licence lets you install the whole platform on your own servers, for your own company. Tell us your constraints and we will say what it takes.`,
    },
    {
      question: $localize`:@@contact-page.faq.payment.question:How do I pay from my country?`,
      answer: $localize`:@@contact-page.faq.payment.answer:Mobile Money in thirteen African countries, or card. The wallet is topped up in CFA francs and spent as you generate.`,
    },
    {
      question: $localize`:@@contact-page.faq.support.question:What help comes with a paid plan?`,
      answer: $localize`:@@contact-page.faq.support.answer:Written support by email, priority on paid plans, and the documentation. Nothing is hidden behind a support contract.`,
    },
    {
      question: $localize`:@@contact-page.faq.reseller.question:I build sites for clients. Can I resell IDEM?`,
      answer: $localize`:@@contact-page.faq.reseller.answer:Agencies and consultants work with us already. Write with the kind of clients you serve and we will set the terms together.`,
    },
  ];

  protected updateForm(field: keyof ContactForm, value: string): void {
    this.form.update((current) => ({ ...current, [field]: value }));
    if (this.errorMessage()) {
      this.errorMessage.set('');
    }
  }

  protected writeAnother(): void {
    this.isSubmitted.set(false);
    this.errorMessage.set('');
  }

  protected async submitForm(): Promise<void> {
    const payload = this.form();

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      this.errorMessage.set(
        $localize`:@@contact-page.error.incomplete:Name, email, subject and message are needed before we can reply.`,
      );
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message?: string }>(
          `${environment.services.api.url}/api/contact`,
          payload,
        ),
      );

      if (!response?.success) {
        throw new Error(response?.message ?? 'contact endpoint refused the message');
      }

      this.isSubmitted.set(true);
      this.form.set({ name: '', email: '', company: '', subject: '', message: '' });
    } catch {
      this.errorMessage.set(
        $localize`:@@contact-page.error.network:The message did not go through. Try again, or write straight to contact@idem.africa.`,
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
