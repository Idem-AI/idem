import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

interface ContactForm {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
}

interface ContactInfo {
  icon: string;
  title: string;
  content: string;
  link?: string;
}

interface FAQ {
  question: string;
  answer: string;
  isOpen: boolean;
}

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './contact-page.html',
  styleUrl: './contact-page.css',
})
export class ContactPage {
  // Form data
  protected readonly form = signal<ContactForm>({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: '',
  });

  protected readonly isSubmitting = signal(false);
  protected readonly isSubmitted = signal(false);
  protected readonly consoleUrl = environment.services.dashboard.url;
  // Contact information
  protected readonly contactInfo: ContactInfo[] = [
    {
      icon: 'email',
      title: 'Email',
      content: 'contact@idem.africa',
      link: 'mailto:contact@idem.africa',
    },
    {
      icon: 'phone',
      title: 'Phone',
      content: '+237 6 95404527',
      link: 'tel:+237695404527',
    },
    {
      icon: 'location',
      title: 'Address',
      content: 'Douala, Cameroon',
    },
    {
      icon: 'time',
      title: 'Business Hours',
      content: 'Mon - Sat: 9AM - 6PM WAT',
    },
  ];

  // FAQ Section
  protected readonly faqs = signal<FAQ[]>([
    {
      question: 'How quickly do you respond to inquiries?',
      answer:
        'We typically respond to all inquiries within 24 hours during business days. For urgent matters, please call us directly.',
      isOpen: false,
    },
    {
      question: 'Do you offer custom enterprise solutions?',
      answer:
        'Yes! We provide tailored solutions for large organizations, including on-premise deployment, custom AI training, and dedicated support.',
      isOpen: false,
    },
    {
      question: 'Can I schedule a demo?',
      answer:
        'Absolutely! We offer personalized demos to show you how IDEM can transform your business. Contact us to schedule a session.',
      isOpen: false,
    },
    {
      question: 'What support do you provide?',
      answer:
        'We offer comprehensive support including documentation, video tutorials, email support, and priority support for paid plans.',
      isOpen: false,
    },
    {
      question: 'Do you have partnerships or reseller programs?',
      answer:
        'Yes, we have partnership opportunities for agencies, consultants, and technology providers. Contact us to learn more about our programs.',
      isOpen: false,
    },
  ]);

  // Form submission
  protected async submitForm(): Promise<void> {
    if (!this.validateForm()) return;

    this.isSubmitting.set(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.isSubmitted.set(true);
      this.resetForm();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // Form validation
  private validateForm(): boolean {
    const formData = this.form();
    return !!(formData.name && formData.email && formData.subject && formData.message);
  }

  // Reset form
  private resetForm(): void {
    this.form.set({
      name: '',
      email: '',
      company: '',
      subject: '',
      message: '',
    });
  }

  // Update form field
  protected updateForm(field: keyof ContactForm, value: string): void {
    this.form.update((current) => ({
      ...current,
      [field]: value,
    }));
  }

  // Toggle FAQ
  protected toggleFAQ(index: number): void {
    this.faqs.update((faqs) =>
      faqs.map((faq, i) => ({
        ...faq,
        isOpen: i === index ? !faq.isOpen : false,
      })),
    );
  }

  // Get SVG icon
  protected getSVGIcon(iconName: string): string {
    const icons: Record<string, string> = {
      email: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>`,
      phone: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>`,
      location: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>`,
      time: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    };
    return icons[iconName] || '';
  }
}
