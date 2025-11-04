import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LegalDocumentTemplate,
  LegalSection,
  LegalNavItem,
} from '../legal-document-template/legal-document-template';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [CommonModule, LegalDocumentTemplate],
  templateUrl: './terms-of-service.html',
  styleUrl: './terms-of-service.css',
})
export class TermsOfService implements OnInit {
  protected title = 'IDEM Legal';
  protected subtitle = 'Terms of Service for IDEM AI-Powered Project Management Platform';
  protected effectiveDate = 'October 10, 2025';
  protected showVersionSelector = true;
  protected versions = ['October 10, 2025', 'August 30, 2025'];
  protected currentVersion = 'October 10, 2025';

  protected navigation: LegalNavItem[] = [
    { id: 'acceptance', title: '1. ACCEPTANCE OF TERMS', titleI18n: '@@terms.nav.acceptance' },
    { id: 'description', title: '2. DESCRIPTION OF SERVICE', titleI18n: '@@terms.nav.description' },
    { id: 'accounts', title: '3. USER ACCOUNTS', titleI18n: '@@terms.nav.accounts' },
    {
      id: 'acceptable-use',
      title: $localize`:@@terms.nav.acceptable_use:4. ACCEPTABLE USE POLICY`,
      titleI18n: '@@terms.nav.acceptable_use',
    },
    {
      id: 'intellectual-property',
      title: $localize`:@@terms.nav.intellectual_property:5. INTELLECTUAL PROPERTY`,
      titleI18n: '@@terms.nav.intellectual_property',
    },
    { id: 'payment', title: '6. PAYMENT AND BILLING', titleI18n: '@@terms.nav.payment' },
    { id: 'privacy', title: '7. PRIVACY AND DATA', titleI18n: '@@terms.nav.privacy' },
    {
      id: 'service-availability',
      title: $localize`:@@terms.nav.service_availability:8. SERVICE AVAILABILITY`,
      titleI18n: '@@terms.nav.service_availability',
    },
    { id: 'disclaimers', title: '9. DISCLAIMERS', titleI18n: '@@terms.nav.disclaimers' },
    {
      id: 'indemnification',
      title: $localize`:@@terms.nav.indemnification:10. INDEMNIFICATION`,
      titleI18n: '@@terms.nav.indemnification',
    },
    { id: 'termination', title: '11. TERMINATION', titleI18n: '@@terms.nav.termination' },
    { id: 'governing-law', title: '12. GOVERNING LAW', titleI18n: '@@terms.nav.governing_law' },
    { id: 'changes', title: '13. CHANGES TO TERMS', titleI18n: '@@terms.nav.changes' },
    { id: 'contact', title: '14. CONTACT', titleI18n: '@@terms.nav.contact' },
  ];

  protected sections: LegalSection[] = [];

  ngOnInit(): void {
    this.sections = [
      {
        id: 'acceptance',
        title: $localize`:@@terms.acceptance.title:1. ACCEPTANCE OF TERMS`,
        titleI18n: '@@terms.acceptance.title',
        content: $localize`:@@terms.acceptance.content:By accessing and using IDEM (\"the Service\", \"Platform\", \"we\", \"us\", or \"our\"), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these Terms of Service, please do not use this service. Your continued use of the Service constitutes acceptance of any modifications to these terms.`,

        contentI18n: '@@terms.acceptance.content',
      },
      {
        id: 'description',
        title: $localize`:@@terms.description.title:2. DESCRIPTION OF SERVICE`,
        titleI18n: '@@terms.description.title',
        content: $localize`:@@terms.description.content:IDEM is an AI-powered project management and development platform that provides comprehensive tools and services for modern software development and project management:`,

        contentI18n: '@@terms.description.content',
        list: [
          {
            strong: $localize`:@@terms.description.project_management.strong:Project Management`,
            strongI18n: '@@terms.description.project_management.strong',
            text: $localize`:@@terms.description.project_management.text:Create, organize, and manage projects with AI-powered insights and recommendations`,
            textI18n: '@@terms.description.project_management.text',
          },
          {
            strong: $localize`:@@terms.description.ai_content.strong:AI-Generated Content`,
            strongI18n: '@@terms.description.ai_content.strong',
            text: $localize`:@@terms.description.ai_content.text:Generate diagrams (UML, ERD, flowcharts), business plans, branding materials, and technical documentation`,
            textI18n: '@@terms.description.ai_content.text',
          },
          {
            strong: $localize`:@@terms.description.dev_tools.strong:Development Tools`,
            strongI18n: '@@terms.description.dev_tools.strong',
            text: $localize`:@@terms.description.dev_tools.text:Deployment assistance, code generation, and development environment management`,
            textI18n: '@@terms.description.dev_tools.text',
          },
          {
            strong: $localize`:@@terms.description.collaboration.strong:Collaboration Features`,
            strongI18n: '@@terms.description.collaboration.strong',
            text: $localize`:@@terms.description.collaboration.text:Team management, real-time collaboration, and communication tools`,
            textI18n: '@@terms.description.collaboration.text',
          },
          {
            strong: $localize`:@@terms.description.analytics.strong:Analytics and Reporting`,
            strongI18n: '@@terms.description.analytics.strong',
            text: $localize`:@@terms.description.analytics.text:Comprehensive analytics, progress tracking, and customizable reports`,
            textI18n: '@@terms.description.analytics.text',
          },
          {
            strong: $localize`:@@terms.description.integrations.strong:Integration Capabilities`,
            strongI18n: '@@terms.description.integrations.strong',
            text: $localize`:@@terms.description.integrations.text:Connect with third-party services, APIs, and development tools`,
            textI18n: '@@terms.description.integrations.text',
          },
        ],
      },
      {
        id: 'accounts',
        title: $localize`:@@terms.accounts.title:3. USER ACCOUNTS AND REGISTRATION`,
        titleI18n: '@@terms.accounts.title',
        content: $localize`:@@terms.accounts.content:To access certain features of the Service, you must register for an account. By creating an account, you agree to:`,

        contentI18n: '@@terms.accounts.content',
        list: [
          {
            text: $localize`:@@terms.accounts.accurate_info:Provide accurate, current, complete, and truthful information during registration`,
            textI18n: '@@terms.accounts.accurate_info',
          },
          {
            text: $localize`:@@terms.accounts.update_info:Maintain and promptly update your account information to keep it accurate and current`,
            textI18n: '@@terms.accounts.update_info',
          },
          {
            text: $localize`:@@terms.accounts.security:Maintain the security and confidentiality of your password and account credentials`,
            textI18n: '@@terms.accounts.security',
          },
          {
            text: $localize`:@@terms.accounts.responsibility:Accept full responsibility for all activities that occur under your account`,
            textI18n: '@@terms.accounts.responsibility',
          },
          {
            text: $localize`:@@terms.accounts.notify_breach:Notify us immediately of any unauthorized use, security breach, or suspected fraud`,
            textI18n: '@@terms.accounts.notify_breach',
          },
          {
            text: $localize`:@@terms.accounts.no_sharing:Not share your account credentials or allow others to access your account`,
            textI18n: '@@terms.accounts.no_sharing',
          },
          {
            text: $localize`:@@terms.accounts.no_multiple:Not create multiple accounts or use automated means to create accounts`,
            textI18n: '@@terms.accounts.no_multiple',
          },
          {
            text: $localize`:@@terms.accounts.age_requirement:Be at least 18 years old or have parental consent to use the Service`,
            textI18n: '@@terms.accounts.age_requirement',
          },
        ],
      },
      {
        id: 'acceptable-use',
        title: $localize`:@@terms.acceptable_use.title:4. ACCEPTABLE USE POLICY`,
        titleI18n: '@@terms.acceptable_use.title',
        content: $localize`:@@terms.acceptable_use.content:You agree to use the Service in compliance with all applicable laws and regulations. You explicitly agree NOT to:`,

        contentI18n: '@@terms.acceptable_use.content',
        subsections: [
          {
            title: $localize`:@@terms.acceptable_use.prohibited.title:4.1 Prohibited Activities`,
            titleI18n: '@@terms.acceptable_use.prohibited.title',
            content: $localize`:@@terms.acceptable_use.prohibited.content:The following activities are strictly prohibited:`,
            contentI18n: '@@terms.acceptable_use.prohibited.content',
            list: [
              {
                text: $localize`:@@terms.acceptable_use.prohibited.violate_laws:Violate any applicable local, state, national, or international laws or regulations`,
                textI18n: '@@terms.acceptable_use.prohibited.violate_laws',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.infringe_ip:Infringe on intellectual property rights, copyrights, trademarks, or patents of others`,
                textI18n: '@@terms.acceptable_use.prohibited.infringe_ip',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.malicious_code:Upload, transmit, or distribute malicious code, viruses, malware, or harmful content`,
                textI18n: '@@terms.acceptable_use.prohibited.malicious_code',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.unauthorized_access:Attempt to gain unauthorized access to our systems, networks, or other user accounts`,
                textI18n: '@@terms.acceptable_use.prohibited.unauthorized_access',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.interfere:Interfere with, disrupt, or impose unreasonable load on the Service or servers`,
                textI18n: '@@terms.acceptable_use.prohibited.interfere',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.illegal_use:Use the Service for any illegal, fraudulent, or unauthorized purpose`,
                textI18n: '@@terms.acceptable_use.prohibited.illegal_use',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.harass:Harass, abuse, threaten, or harm other users or third parties`,
                textI18n: '@@terms.acceptable_use.prohibited.harass',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.spam:Distribute spam, unsolicited communications, or engage in phishing`,
                textI18n: '@@terms.acceptable_use.prohibited.spam',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.scraping:Scrape, crawl, or use automated tools to extract data without permission`,
                textI18n: '@@terms.acceptable_use.prohibited.scraping',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.reverse_engineer:Reverse engineer, decompile, or disassemble any part of the Service`,
                textI18n: '@@terms.acceptable_use.prohibited.reverse_engineer',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.remove_notices:Remove, obscure, or alter any proprietary notices or labels`,
                textI18n: '@@terms.acceptable_use.prohibited.remove_notices',
              },
              {
                text: $localize`:@@terms.acceptable_use.prohibited.impersonate:Impersonate any person or entity or misrepresent your affiliation`,
                textI18n: '@@terms.acceptable_use.prohibited.impersonate',
              },
            ],
          },
          {
            title: $localize`:@@terms.acceptable_use.content_standards.title:4.2 Content Standards`,
            titleI18n: '@@terms.acceptable_use.content_standards.title',
            content: $localize`:@@terms.acceptable_use.content_standards.content:All content you create, upload, or share must comply with the following standards:`,

            contentI18n: '@@terms.acceptable_use.content_standards.content',
            list: [
              {
                text: $localize`:@@terms.acceptable_use.content_standards.no_illegal:Must not contain illegal, defamatory, obscene, or offensive material`,
                textI18n: '@@terms.acceptable_use.content_standards.no_illegal',
              },
              {
                text: $localize`:@@terms.acceptable_use.content_standards.no_privacy_violation:Must not violate privacy rights or disclose confidential information without authorization`,
                textI18n: '@@terms.acceptable_use.content_standards.no_privacy_violation',
              },
              {
                text: $localize`:@@terms.acceptable_use.content_standards.no_hate:Must not promote violence, discrimination, or hate speech`,
                textI18n: '@@terms.acceptable_use.content_standards.no_hate',
              },
              {
                text: $localize`:@@terms.acceptable_use.content_standards.no_misleading:Must not contain misleading, false, or deceptive information`,
                textI18n: '@@terms.acceptable_use.content_standards.no_misleading',
              },
            ],
          },
        ],
      },
      {
        id: 'intellectual-property',
        title: $localize`:@@terms.intellectual_property.title:5. INTELLECTUAL PROPERTY RIGHTS`,
        titleI18n: '@@terms.intellectual_property.title',
        content: $localize`:@@terms.intellectual_property.content:Intellectual property rights are governed by the following terms:`,
        contentI18n: '@@terms.intellectual_property.content',
        subsections: [
          {
            title: $localize`:@@terms.intellectual_property.our_content.title:5.1 Our Content and Platform`,
            titleI18n: '@@terms.intellectual_property.our_content.title',
            content: $localize`:@@terms.intellectual_property.our_content.content:The Service and its original content, features, functionality, design, code, and all related intellectual property are owned by IDEM and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of our Service without explicit written permission.`,

            contentI18n: '@@terms.intellectual_property.our_content.content',
          },
          {
            title: $localize`:@@terms.intellectual_property.your_content.title:5.2 Your Content`,
            titleI18n: '@@terms.intellectual_property.your_content.title',
            content: $localize`:@@terms.intellectual_property.your_content.content:You retain full ownership of all content you create, upload, or submit to the Service. By using the Service, you grant us a non-exclusive, worldwide, royalty-free, sublicensable, and transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform your content solely for the purpose of providing, maintaining, and improving the Service.`,

            contentI18n: '@@terms.intellectual_property.your_content.content',
          },
          {
            title: $localize`:@@terms.intellectual_property.ai_content.title:5.3 AI-Generated Content`,
            titleI18n: '@@terms.intellectual_property.ai_content.title',
            content: $localize`:@@terms.intellectual_property.ai_content.content:Content generated by our AI tools based on your inputs and prompts is provided to you under a non-exclusive, worldwide, royalty-free license. You may use, modify, and distribute AI-generated content for your personal and commercial purposes, subject to these terms. However, we cannot guarantee that AI-generated content is free from third-party intellectual property claims.`,

            contentI18n: '@@terms.intellectual_property.ai_content.content',
          },
          {
            title: $localize`:@@terms.intellectual_property.feedback.title:5.4 Feedback and Suggestions`,
            titleI18n: '@@terms.intellectual_property.feedback.title',
            content: $localize`:@@terms.intellectual_property.feedback.content:Any feedback, suggestions, ideas, or other information you provide to us about the Service becomes our property. We may use this feedback without any obligation to compensate you or provide attribution.`,

            contentI18n: '@@terms.intellectual_property.feedback.content',
          },
        ],
      },
      {
        id: 'payment',
        title: $localize`:@@terms.payment.title:6. PAYMENT AND BILLING`,
        titleI18n: '@@terms.payment.title',
        content: $localize`:@@terms.payment.content:Certain features and services require payment. By subscribing to a paid plan, you agree to:`,

        contentI18n: '@@terms.payment.content',
        list: [
          {
            strong: $localize`:@@terms.payment.obligation.strong:Payment Obligation`,
            strongI18n: '@@terms.payment.obligation.strong',
            text: $localize`:@@terms.payment.obligation.text:Pay all fees and charges associated with your account and subscription plan`,
            textI18n: '@@terms.payment.obligation.text',
          },
          {
            strong: $localize`:@@terms.payment.billing_info.strong:Billing Information`,
            strongI18n: '@@terms.payment.billing_info.strong',
            text: $localize`:@@terms.payment.billing_info.text:Provide accurate, complete, and current billing and payment information`,
            textI18n: '@@terms.payment.billing_info.text',
          },
          {
            strong: $localize`:@@terms.payment.updates.strong:Updates`,
            strongI18n: '@@terms.payment.updates.strong',
            text: $localize`:@@terms.payment.updates.text:Notify us promptly of any changes to your payment information or billing address`,
            textI18n: '@@terms.payment.updates.text',
          },
          {
            strong: $localize`:@@terms.payment.authorization.strong:Authorization`,
            strongI18n: '@@terms.payment.authorization.strong',
            text: $localize`:@@terms.payment.authorization.text:Authorize us to charge your payment method for all fees and charges`,
            textI18n: '@@terms.payment.authorization.text',
          },
          {
            strong: $localize`:@@terms.payment.subscription.strong:Subscription Terms`,
            strongI18n: '@@terms.payment.subscription.strong',
            text: $localize`:@@terms.payment.subscription.text:Subscription fees are billed in advance on a recurring basis (monthly or annually)`,
            textI18n: '@@terms.payment.subscription.text',
          },
          {
            strong: $localize`:@@terms.payment.auto_renewal.strong:Auto-Renewal`,
            strongI18n: '@@terms.payment.auto_renewal.strong',
            text: $localize`:@@terms.payment.auto_renewal.text:Subscriptions automatically renew unless cancelled before the renewal date`,
            textI18n: '@@terms.payment.auto_renewal.text',
          },
          {
            strong: $localize`:@@terms.payment.refund.strong:Refund Policy`,
            strongI18n: '@@terms.payment.refund.strong',
            text: $localize`:@@terms.payment.refund.text:Subscription fees are generally non-refundable except as required by law or stated in our refund policy`,
            textI18n: '@@terms.payment.refund.text',
          },
          {
            strong: $localize`:@@terms.payment.price_changes.strong:Price Changes`,
            strongI18n: '@@terms.payment.price_changes.strong',
            text: $localize`:@@terms.payment.price_changes.text:We reserve the right to change pricing with 30 days advance notice`,
            textI18n: '@@terms.payment.price_changes.text',
          },
          {
            strong: $localize`:@@terms.payment.taxes.strong:Taxes`,
            strongI18n: '@@terms.payment.taxes.strong',
            text: $localize`:@@terms.payment.taxes.text:You are responsible for all applicable taxes, duties, and government charges`,
            textI18n: '@@terms.payment.taxes.text',
          },
        ],
      },
      {
        id: 'privacy',
        title: $localize`:@@terms.privacy.title:7. PRIVACY AND DATA PROTECTION`,
        titleI18n: '@@terms.privacy.title',
        content: $localize`:@@terms.privacy.content:Your privacy is important to us. Our Privacy Policy explains in detail how we collect, use, protect, and share your information when you use the Service. By using the Service, you agree to the collection, use, and disclosure of information in accordance with our Privacy Policy. Key points include:`,

        contentI18n: '@@terms.privacy.content',
        list: [
          {
            text: $localize`:@@terms.privacy.collection:We collect personal information you provide and technical data automatically`,
            textI18n: '@@terms.privacy.collection',
          },
          {
            text: $localize`:@@terms.privacy.usage:We use your data to provide, improve, and personalize the Service`,
            textI18n: '@@terms.privacy.usage',
          },
          {
            text: $localize`:@@terms.privacy.security:We implement industry-standard security measures to protect your data`,
            textI18n: '@@terms.privacy.security',
          },
          {
            text: $localize`:@@terms.privacy.no_selling:We do not sell your personal information to third parties`,
            textI18n: '@@terms.privacy.no_selling',
          },
          {
            text: $localize`:@@terms.privacy.rights:You have rights to access, correct, delete, and port your data`,
            textI18n: '@@terms.privacy.rights',
          },
        ],
      },
      {
        id: 'service-availability',
        title: $localize`:@@terms.service_availability.title:8. SERVICE AVAILABILITY AND MODIFICATIONS`,
        titleI18n: '@@terms.service_availability.title',
        content: $localize`:@@terms.service_availability.content:We strive to provide reliable service but cannot guarantee uninterrupted availability. We reserve the right to:`,

        contentI18n: '@@terms.service_availability.content',
        list: [
          {
            text: $localize`:@@terms.service_availability.modify:Modify, suspend, or discontinue any part of the Service at any time with reasonable notice`,
            textI18n: '@@terms.service_availability.modify',
          },
          {
            text: $localize`:@@terms.service_availability.maintenance:Perform scheduled maintenance, updates, and upgrades that may cause temporary interruptions`,
            textI18n: '@@terms.service_availability.maintenance',
          },
          {
            text: $localize`:@@terms.service_availability.update_terms:Update these Terms of Service with advance notice for material changes`,
            textI18n: '@@terms.service_availability.update_terms',
          },
          {
            text: $localize`:@@terms.service_availability.refuse_service:Refuse service to anyone for any lawful reason`,
            textI18n: '@@terms.service_availability.refuse_service',
          },
          {
            text: $localize`:@@terms.service_availability.remove_content:Remove, modify, or restrict access to content that violates these terms`,
            textI18n: '@@terms.service_availability.remove_content',
          },
          {
            text: $localize`:@@terms.service_availability.change_features:Change features, functionality, pricing, or service tiers`,
            textI18n: '@@terms.service_availability.change_features',
          },
          {
            text: $localize`:@@terms.service_availability.usage_limits:Impose usage limits, quotas, or restrictions on certain features`,
            textI18n: '@@terms.service_availability.usage_limits',
          },
        ],
      },
      {
        id: 'disclaimers',
        title: $localize`:@@terms.disclaimers.title:9. DISCLAIMERS AND LIMITATIONS OF LIABILITY`,
        titleI18n: '@@terms.disclaimers.title',
        content: $localize`:@@terms.disclaimers.content:The Service is provided under the following disclaimers and liability limitations:`,

        contentI18n: '@@terms.disclaimers.content',
        subsections: [
          {
            title: $localize`:@@terms.disclaimers.service.title:9.1 Service Disclaimer`,
            titleI18n: '@@terms.disclaimers.service.title',
            content: $localize`:@@terms.disclaimers.service.content:THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, TITLE, QUIET ENJOYMENT, ACCURACY, OR INTEGRATION. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE FROM VIRUSES OR OTHER HARMFUL COMPONENTS.`,

            contentI18n: '@@terms.disclaimers.service.content',
          },
          {
            title: $localize`:@@terms.disclaimers.ai_content.title:9.2 AI Content Disclaimer`,
            titleI18n: '@@terms.disclaimers.ai_content.title',
            content: $localize`:@@terms.disclaimers.ai_content.content:AI-generated content is provided for informational and assistance purposes only. We do not guarantee the accuracy, completeness, reliability, quality, or appropriateness of AI-generated content. You should independently verify all AI-generated content before using it for business, legal, financial, or other important purposes. AI-generated content may contain errors, biases, or inaccuracies.`,

            contentI18n: '@@terms.disclaimers.ai_content.content',
          },
          {
            title: $localize`:@@terms.disclaimers.third_party.title:9.3 Third-Party Content and Services`,
            titleI18n: '@@terms.disclaimers.third_party.title',
            content: $localize`:@@terms.disclaimers.third_party.content:The Service may contain links to third-party websites, services, or content. We are not responsible for the availability, accuracy, content, or practices of third-party services. Your use of third-party services is at your own risk and subject to their terms and policies.`,

            contentI18n: '@@terms.disclaimers.third_party.content',
          },
          {
            title: $localize`:@@terms.disclaimers.liability.title:9.4 Limitation of Liability`,
            titleI18n: '@@terms.disclaimers.liability.title',
            content: $localize`:@@terms.disclaimers.liability.content:TO THE MAXIMUM EXTENT PERMITTED BY LAW, IDEM AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUES, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, ARISING FROM: (A) YOUR USE OR INABILITY TO USE THE SERVICE; (B) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SERVERS OR YOUR DATA; (C) ANY INTERRUPTION OR CESSATION OF THE SERVICE; (D) ANY BUGS, VIRUSES, OR HARMFUL CODE; (E) ANY ERRORS OR OMISSIONS IN CONTENT; OR (F) ANY USER CONTENT OR CONDUCT. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.`,

            contentI18n: '@@terms.disclaimers.liability.content',
          },
        ],
      },
      {
        id: 'indemnification',
        title: $localize`:@@terms.indemnification.title:10. INDEMNIFICATION`,
        titleI18n: '@@terms.indemnification.title',
        content: $localize`:@@terms.indemnification.content:You agree to defend, indemnify, and hold harmless IDEM and its officers, directors, employees, contractors, agents, suppliers, and affiliates from and against any and all claims, damages, obligations, losses, liabilities, costs, debts, and expenses (including attorney fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights, including intellectual property, privacy, or other proprietary rights; (d) any content you submit, post, or transmit through the Service; or (e) any willful misconduct or negligence.`,

        contentI18n: '@@terms.indemnification.content',
      },
      {
        id: 'termination',
        title: $localize`:@@terms.termination.title:11. TERMINATION`,
        titleI18n: '@@terms.termination.title',
        content: $localize`:@@terms.termination.content:Either party may terminate this agreement under the following conditions:`,
        contentI18n: '@@terms.termination.content',
        subsections: [
          {
            title: $localize`:@@terms.termination.by_you.title:11.1 Termination by You`,
            titleI18n: '@@terms.termination.by_you.title',
            content: $localize`:@@terms.termination.by_you.content:You may terminate your account at any time by following the account closure process in your settings. Upon termination, your access to the Service will cease, but you remain responsible for any outstanding fees.`,

            contentI18n: '@@terms.termination.by_you.content',
          },
          {
            title: $localize`:@@terms.termination.by_us.title:11.2 Termination by Us`,
            titleI18n: '@@terms.termination.by_us.title',
            content: $localize`:@@terms.termination.by_us.content:We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including but not limited to:`,

            contentI18n: '@@terms.termination.by_us.content',
            list: [
              {
                text: $localize`:@@terms.termination.by_us.violation:Violation of these Terms of Service or our policies`,
                textI18n: '@@terms.termination.by_us.violation',
              },
              {
                text: $localize`:@@terms.termination.by_us.nonpayment:Non-payment of fees or fraudulent payment activity`,
                textI18n: '@@terms.termination.by_us.nonpayment',
              },
              {
                text: $localize`:@@terms.termination.by_us.illegal:Illegal, fraudulent, or abusive activity`,
                textI18n: '@@terms.termination.by_us.illegal',
              },
              {
                text: $localize`:@@terms.termination.by_us.inactivity:Prolonged inactivity or abandonment of account`,
                textI18n: '@@terms.termination.by_us.inactivity',
              },
              {
                text: $localize`:@@terms.termination.by_us.security:Security concerns or risk to the Service or other users`,
                textI18n: '@@terms.termination.by_us.security',
              },
              {
                text: $localize`:@@terms.termination.by_us.discontinuation:Discontinuation of the Service`,
                textI18n: '@@terms.termination.by_us.discontinuation',
              },
            ],
          },
          {
            title: $localize`:@@terms.termination.effect.title:11.3 Effect of Termination`,
            titleI18n: '@@terms.termination.effect.title',
            content: $localize`:@@terms.termination.effect.content:Upon termination: (a) your right to use the Service will cease immediately; (b) we may delete your account and data after a reasonable grace period; (c) you remain liable for all fees and charges incurred prior to termination; (d) provisions that by their nature should survive termination will survive, including intellectual property rights, disclaimers, indemnification, and limitations of liability.`,

            contentI18n: '@@terms.termination.effect.content',
          },
        ],
      },
      {
        id: 'governing-law',
        title: $localize`:@@terms.governing_law.title:12. GOVERNING LAW AND DISPUTE RESOLUTION`,
        titleI18n: '@@terms.governing_law.title',
        content: $localize`:@@terms.governing_law.content:These Terms shall be governed by and construed in accordance with the laws of [Jurisdiction], without regard to its conflict of law provisions. Any disputes, claims, or controversies arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of [Arbitration Organization], except that either party may seek injunctive or other equitable relief in court. You waive any right to a jury trial or to participate in a class action lawsuit.`,

        contentI18n: '@@terms.governing_law.content',
      },
      {
        id: 'changes',
        title: $localize`:@@terms.changes.title:13. CHANGES TO THESE TERMS`,
        titleI18n: '@@terms.changes.title',
        content: $localize`:@@terms.changes.content:We reserve the right to modify these Terms of Service at any time. We will provide notice of material changes by posting the updated terms on this page and updating the \"Effective Date\" at the top. For significant changes, we may provide additional notice such as an email notification or in-app message. Your continued use of the Service after changes take effect constitutes acceptance of the modified terms. If you do not agree to the changes, you must stop using the Service and may terminate your account.`,

        contentI18n: '@@terms.changes.content',
      },
      {
        id: 'contact',
        title: $localize`:@@terms.contact.title:14. CONTACT INFORMATION`,
        titleI18n: '@@terms.contact.title',
        content: $localize`:@@terms.contact.content:If you have any questions, concerns, or requests regarding these Terms of Service, please contact us at:`,

        contentI18n: '@@terms.contact.content',
      },
    ];
  }
}
