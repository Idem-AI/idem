import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LegalDocumentTemplate,
  LegalSection,
  LegalNavItem,
} from '../legal-document-template/legal-document-template';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, LegalDocumentTemplate],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.css',
})
export class PrivacyPolicy implements OnInit {
  protected title = $localize`:@@privacy.title:IDEM Legal`;
  protected subtitle = $localize`:@@privacy.subtitle:The information provided here is for IDEM customers and users who have questions about our terms, policies, intellectual property, and compliance.`;
  protected effectiveDate = $localize`:@@privacy.effective_date:October 10, 2025`;
  protected showVersionSelector = true;
  protected versions = [
    $localize`:@@privacy.version.oct2025:October 10, 2025`,
    $localize`:@@privacy.version.aug2025:August 30, 2025`,
    $localize`:@@privacy.version.jun2025:June 15, 2025`,
  ];
  protected currentVersion = $localize`:@@privacy.current_version:October 10, 2025`;

  protected navigation: LegalNavItem[] = [
    {
      id: 'about',
      title: $localize`:@@privacy.nav.about:1. ABOUT`,
      titleI18n: '@@privacy.nav.about',
    },
    {
      id: 'scope',
      title: $localize`:@@privacy.nav.scope:2. SCOPE`,
      titleI18n: '@@privacy.nav.scope',
    },
    {
      id: 'personal-info',
      title: $localize`:@@privacy.nav.personal_info:3. PERSONAL INFORMATION WE COLLECT`,
      titleI18n: '@@privacy.nav.personal_info',
      children: [
        {
          id: 'info-you-provide',
          title: $localize`:@@privacy.nav.info_you_provide:Information You Provide`,
          titleI18n: '@@privacy.nav.info_you_provide',
        },
        {
          id: 'info-collected-auto',
          title: $localize`:@@privacy.nav.info_collected_auto:Information Collected Automatically`,
          titleI18n: '@@privacy.nav.info_collected_auto',
        },
        {
          id: 'info-from-sources',
          title: $localize`:@@privacy.nav.info_from_sources:Information from Other Sources`,
          titleI18n: '@@privacy.nav.info_from_sources',
        },
      ],
    },
    {
      id: 'how-we-use',
      title: $localize`:@@privacy.nav.how_we_use:4. HOW WE USE YOUR INFORMATION`,
      titleI18n: '@@privacy.nav.how_we_use',
    },
    {
      id: 'disclosure',
      title: $localize`:@@privacy.nav.disclosure:5. DISCLOSING YOUR INFORMATION`,
      titleI18n: '@@privacy.nav.disclosure',
    },
    {
      id: 'data-transfers',
      title: $localize`:@@privacy.nav.data_transfers:6. INTERNATIONAL DATA TRANSFERS`,
      titleI18n: '@@privacy.nav.data_transfers',
    },
    {
      id: 'your-choices',
      title: $localize`:@@privacy.nav.your_choices:7. YOUR CHOICES`,
      titleI18n: '@@privacy.nav.your_choices',
    },
    {
      id: 'your-rights',
      title: $localize`:@@privacy.nav.your_rights:8. YOUR PRIVACY RIGHTS`,
      titleI18n: '@@privacy.nav.your_rights',
    },
    {
      id: 'data-retention',
      title: $localize`:@@privacy.nav.data_retention:9. DATA RETENTION`,
      titleI18n: '@@privacy.nav.data_retention',
    },
    {
      id: 'security',
      title: $localize`:@@privacy.nav.security:10. SECURITY`,
      titleI18n: '@@privacy.nav.security',
    },
    {
      id: 'third-party',
      title: $localize`:@@privacy.nav.third_party:11. THIRD-PARTY WEBSITES`,
      titleI18n: '@@privacy.nav.third_party',
    },
    {
      id: 'children',
      title: $localize`:@@privacy.nav.children:12. CHILDREN'S INFORMATION`,
      titleI18n: '@@privacy.nav.children',
    },
    {
      id: 'changes',
      title: $localize`:@@privacy.nav.changes:13. CHANGES TO POLICY`,
      titleI18n: '@@privacy.nav.changes',
    },
    {
      id: 'contact',
      title: $localize`:@@privacy.nav.contact:14. CONTACT US`,
      titleI18n: '@@privacy.nav.contact',
    },
  ];

  protected sections: LegalSection[] = [];

  ngOnInit(): void {
    this.sections = [
      {
        id: 'about',
        title: $localize`:@@privacy.about.title:1. ABOUT`,
        titleI18n: '@@privacy.about.title',
        content: $localize`:@@privacy.about.content:IDEM, Inc. and its affiliates (\"IDEM,\" \"we,\" \"us,\" and \"our\") goal is to make AI-powered project management accessible to all. This Privacy Policy will help you understand how we collect, use and disclose your personal information and assist you in exercising the privacy rights available to you.`,

        contentI18n: '@@privacy.about.content',
      },
      {
        id: 'scope',
        title: $localize`:@@privacy.scope.title:2. SCOPE`,
        titleI18n: '@@privacy.scope.title',
        content: $localize`:@@privacy.scope.content:This Privacy Policy applies to personal information processed by us, including on our websites (e.g., idem.africa and any other websites that we own or operate), our mobile applications, our application program interfaces, our AI-powered project management services, and our related online and offline offerings (collectively, the \"Services\").`,

        contentI18n: '@@privacy.scope.content',
      },
      {
        id: 'personal-info',
        title: $localize`:@@privacy.personal_info.title:3. PERSONAL INFORMATION WE COLLECT`,
        titleI18n: '@@privacy.personal_info.title',
        content: $localize`:@@privacy.personal_info.content:The personal information we collect depends on how you interact with our Services.`,

        contentI18n: '@@privacy.personal_info.content',
        subsections: [
          {
            title: $localize`:@@privacy.personal_info.you_provide.title:3.1 Information You Provide to Us`,
            titleI18n: '@@privacy.personal_info.you_provide.title',
            content: $localize`:@@privacy.personal_info.you_provide.content:We collect personal information that you provide directly to us when using our Services:`,

            contentI18n: '@@privacy.personal_info.you_provide.content',
            list: [
              {
                text: $localize`:@@privacy.personal_info.you_provide.account:Account information including name, email address, and password`,
                textI18n: '@@privacy.personal_info.you_provide.account',
              },
              {
                text: $localize`:@@privacy.personal_info.you_provide.profile:Profile information such as photo, job title, and company details`,
                textI18n: '@@privacy.personal_info.you_provide.profile',
              },
              {
                text: $localize`:@@privacy.personal_info.you_provide.project_data:Project data including diagrams, business plans, and branding materials`,
                textI18n: '@@privacy.personal_info.you_provide.project_data',
              },
              {
                text: $localize`:@@privacy.personal_info.you_provide.payment:Payment information for subscription services`,
                textI18n: '@@privacy.personal_info.you_provide.payment',
              },
              {
                text: $localize`:@@privacy.personal_info.you_provide.communications:Communications when you contact support or provide feedback`,
                textI18n: '@@privacy.personal_info.you_provide.communications',
              },
            ],
          },
          {
            title: $localize`:@@privacy.personal_info.collected_auto.title:3.2 Information Collected Automatically`,
            titleI18n: '@@privacy.personal_info.collected_auto.title',
            content: $localize`:@@privacy.personal_info.collected_auto.content:When you use our Services, we automatically collect certain technical information:`,

            contentI18n: '@@privacy.personal_info.collected_auto.content',
            list: [
              {
                text: $localize`:@@privacy.personal_info.collected_auto.device:Device information (type, operating system, browser)`,
                textI18n: '@@privacy.personal_info.collected_auto.device',
              },
              {
                text: $localize`:@@privacy.personal_info.collected_auto.ip:IP address and general location data`,
                textI18n: '@@privacy.personal_info.collected_auto.ip',
              },
              {
                text: $localize`:@@privacy.personal_info.collected_auto.usage:Usage data (features used, time spent, interactions)`,
                textI18n: '@@privacy.personal_info.collected_auto.usage',
              },
              {
                text: $localize`:@@privacy.personal_info.collected_auto.cookies:Cookies and similar tracking technologies`,
                textI18n: '@@privacy.personal_info.collected_auto.cookies',
              },
              {
                text: $localize`:@@privacy.personal_info.collected_auto.logs:Log files and error reports`,
                textI18n: '@@privacy.personal_info.collected_auto.logs',
              },
            ],
          },
          {
            title: $localize`:@@privacy.personal_info.other_sources.title:3.3 Information from Other Sources`,
            titleI18n: '@@privacy.personal_info.other_sources.title',
            content: $localize`:@@privacy.personal_info.other_sources.content:We may receive information about you from third-party sources such as authentication providers (Google, GitHub), payment processors, and analytics services.`,

            contentI18n: '@@privacy.personal_info.other_sources.content',
          },
        ],
      },
      {
        id: 'how-we-use',
        title: $localize`:@@privacy.how_we_use.title:4. HOW WE USE YOUR INFORMATION AND OUR LEGAL BASIS FOR PROCESSING`,
        titleI18n: '@@privacy.how_we_use.title',
        content: $localize`:@@privacy.how_we_use.content:We use the personal information we collect for the following purposes:`,
        contentI18n: '@@privacy.how_we_use.content',
        list: [
          {
            strong: $localize`:@@privacy.how_we_use.provide_services.strong:Provide Services`,
            strongI18n: '@@privacy.how_we_use.provide_services.strong',
            text: $localize`:@@privacy.how_we_use.provide_services.text:To operate and maintain our AI-powered platform, process your requests, and enable collaboration features`,
            textI18n: '@@privacy.how_we_use.provide_services.text',
          },
          {
            strong: $localize`:@@privacy.how_we_use.improve.strong:Improve and Personalize`,
            strongI18n: '@@privacy.how_we_use.improve.strong',
            text: $localize`:@@privacy.how_we_use.improve.text:To enhance your experience, develop new features, and provide personalized recommendations`,
            textI18n: '@@privacy.how_we_use.improve.text',
          },
          {
            strong: $localize`:@@privacy.how_we_use.ai_processing.strong:AI Processing`,
            strongI18n: '@@privacy.how_we_use.ai_processing.strong',
            text: $localize`:@@privacy.how_we_use.ai_processing.text:To generate diagrams, business plans, branding materials, and other AI-powered insights`,
            textI18n: '@@privacy.how_we_use.ai_processing.text',
          },
          {
            strong: $localize`:@@privacy.how_we_use.communications.strong:Communications`,
            strongI18n: '@@privacy.how_we_use.communications.strong',
            text: $localize`:@@privacy.how_we_use.communications.text:To send service updates, respond to inquiries, and provide customer support`,
            textI18n: '@@privacy.how_we_use.communications.text',
          },
          {
            strong: $localize`:@@privacy.how_we_use.security.strong:Security and Fraud Prevention`,
            strongI18n: '@@privacy.how_we_use.security.strong',
            text: $localize`:@@privacy.how_we_use.security.text:To protect our Services, detect and prevent fraud, and ensure platform integrity`,
            textI18n: '@@privacy.how_we_use.security.text',
          },
          {
            strong: $localize`:@@privacy.how_we_use.legal.strong:Legal Compliance`,
            strongI18n: '@@privacy.how_we_use.legal.strong',
            text: $localize`:@@privacy.how_we_use.legal.text:To comply with legal obligations and enforce our terms of service`,
            textI18n: '@@privacy.how_we_use.legal.text',
          },
        ],
      },
      {
        id: 'disclosure',
        title: $localize`:@@privacy.disclosure.title:5. DISCLOSING YOUR INFORMATION TO THIRD PARTIES`,
        titleI18n: '@@privacy.disclosure.title',
        content: $localize`:@@privacy.disclosure.content:We do not sell your personal information. We may share your information in the following circumstances:`,

        contentI18n: '@@privacy.disclosure.content',
        list: [
          {
            strong: $localize`:@@privacy.disclosure.service_providers.strong:Service Providers`,
            strongI18n: '@@privacy.disclosure.service_providers.strong',
            text: $localize`:@@privacy.disclosure.service_providers.text:With trusted vendors who assist in operating our platform (cloud hosting, payment processing, analytics)`,
            textI18n: '@@privacy.disclosure.service_providers.text',
          },
          {
            strong: $localize`:@@privacy.disclosure.ai_providers.strong:AI Service Providers`,
            strongI18n: '@@privacy.disclosure.ai_providers.strong',
            text: $localize`:@@privacy.disclosure.ai_providers.text:With AI model providers to generate content based on your inputs`,
            textI18n: '@@privacy.disclosure.ai_providers.text',
          },
          {
            strong: $localize`:@@privacy.disclosure.team_members.strong:Team Members`,
            strongI18n: '@@privacy.disclosure.team_members.strong',
            text: $localize`:@@privacy.disclosure.team_members.text:With other members of your team or organization as configured by you`,
            textI18n: '@@privacy.disclosure.team_members.text',
          },
          {
            strong: $localize`:@@privacy.disclosure.legal.strong:Legal Requirements`,
            strongI18n: '@@privacy.disclosure.legal.strong',
            text: $localize`:@@privacy.disclosure.legal.text:When required by law, court order, or to protect our rights and safety`,
            textI18n: '@@privacy.disclosure.legal.text',
          },
          {
            strong: $localize`:@@privacy.disclosure.business.strong:Business Transfers`,
            strongI18n: '@@privacy.disclosure.business.strong',
            text: $localize`:@@privacy.disclosure.business.text:In connection with mergers, acquisitions, or asset sales`,
            textI18n: '@@privacy.disclosure.business.text',
          },
        ],
      },
      {
        id: 'data-transfers',
        title: $localize`:@@privacy.data_transfers.title:6. INTERNATIONAL DATA TRANSFERS`,
        titleI18n: '@@privacy.data_transfers.title',
        content: $localize`:@@privacy.data_transfers.content:Your information may be transferred to and processed in countries other than your own, including the United States and other jurisdictions where we or our service providers operate. We ensure appropriate safeguards are in place to protect your data during international transfers, including standard contractual clauses approved by the European Commission.`,

        contentI18n: '@@privacy.data_transfers.content',
      },
      {
        id: 'your-choices',
        title: $localize`:@@privacy.your_choices.title:7. YOUR CHOICES`,
        titleI18n: '@@privacy.your_choices.title',
        content: $localize`:@@privacy.your_choices.content:You have several choices regarding your personal information:`,
        contentI18n: '@@privacy.your_choices.content',
        list: [
          {
            strong: $localize`:@@privacy.your_choices.account.strong:Account Settings`,
            strongI18n: '@@privacy.your_choices.account.strong',
            text: $localize`:@@privacy.your_choices.account.text:Update your profile information and preferences at any time`,
            textI18n: '@@privacy.your_choices.account.text',
          },
          {
            strong: $localize`:@@privacy.your_choices.email.strong:Email Communications`,
            strongI18n: '@@privacy.your_choices.email.strong',
            text: $localize`:@@privacy.your_choices.email.text:Opt out of marketing emails using the unsubscribe link`,
            textI18n: '@@privacy.your_choices.email.text',
          },
          {
            strong: $localize`:@@privacy.your_choices.cookies.strong:Cookies`,
            strongI18n: '@@privacy.your_choices.cookies.strong',
            text: $localize`:@@privacy.your_choices.cookies.text:Control cookie settings through your browser preferences`,
            textI18n: '@@privacy.your_choices.cookies.text',
          },
          {
            strong: $localize`:@@privacy.your_choices.deletion.strong:Data Deletion`,
            strongI18n: '@@privacy.your_choices.deletion.strong',
            text: $localize`:@@privacy.your_choices.deletion.text:Request deletion of your account and associated data`,
            textI18n: '@@privacy.your_choices.deletion.text',
          },
        ],
      },
      {
        id: 'your-rights',
        title: $localize`:@@privacy.your_rights.title:8. YOUR PRIVACY RIGHTS`,
        titleI18n: '@@privacy.your_rights.title',
        content: $localize`:@@privacy.your_rights.content:Depending on your location, you may have the following rights regarding your personal information:`,

        contentI18n: '@@privacy.your_rights.content',
        list: [
          {
            strong: $localize`:@@privacy.your_rights.access.strong:Access`,
            strongI18n: '@@privacy.your_rights.access.strong',
            text: $localize`:@@privacy.your_rights.access.text:Request a copy of the personal information we hold about you`,
            textI18n: '@@privacy.your_rights.access.text',
          },
          {
            strong: $localize`:@@privacy.your_rights.correction.strong:Correction`,
            strongI18n: '@@privacy.your_rights.correction.strong',
            text: $localize`:@@privacy.your_rights.correction.text:Request correction of inaccurate or incomplete information`,
            textI18n: '@@privacy.your_rights.correction.text',
          },
          {
            strong: $localize`:@@privacy.your_rights.deletion.strong:Deletion`,
            strongI18n: '@@privacy.your_rights.deletion.strong',
            text: $localize`:@@privacy.your_rights.deletion.text:Request deletion of your personal data (subject to legal obligations)`,
            textI18n: '@@privacy.your_rights.deletion.text',
          },
          {
            strong: $localize`:@@privacy.your_rights.portability.strong:Portability`,
            strongI18n: '@@privacy.your_rights.portability.strong',
            text: $localize`:@@privacy.your_rights.portability.text:Request transfer of your data to another service provider`,
            textI18n: '@@privacy.your_rights.portability.text',
          },
          {
            strong: $localize`:@@privacy.your_rights.objection.strong:Objection`,
            strongI18n: '@@privacy.your_rights.objection.strong',
            text: $localize`:@@privacy.your_rights.objection.text:Object to certain processing activities`,
            textI18n: '@@privacy.your_rights.objection.text',
          },
          {
            strong: $localize`:@@privacy.your_rights.withdraw.strong:Withdraw Consent`,
            strongI18n: '@@privacy.your_rights.withdraw.strong',
            text: $localize`:@@privacy.your_rights.withdraw.text:Withdraw consent for processing based on consent`,
            textI18n: '@@privacy.your_rights.withdraw.text',
          },
        ],
      },
      {
        id: 'data-retention',
        title: $localize`:@@privacy.data_retention.title:9. DATA RETENTION`,
        titleI18n: '@@privacy.data_retention.title',
        content: $localize`:@@privacy.data_retention.content:We retain your personal information for as long as necessary to provide our Services and fulfill the purposes outlined in this policy. When you delete your account, we will delete or anonymize your data within 90 days, unless we are required to retain it by law. Backup copies may persist for an additional 30 days.`,

        contentI18n: '@@privacy.data_retention.content',
      },
      {
        id: 'security',
        title: $localize`:@@privacy.security.title:10. SECURITY OF YOUR INFORMATION`,
        titleI18n: '@@privacy.security.title',
        content: $localize`:@@privacy.security.content:We implement appropriate technical and organizational security measures to protect your personal information:`,

        contentI18n: '@@privacy.security.content',
        list: [
          {
            text: $localize`:@@privacy.security.encryption:Encryption of data in transit (TLS/SSL) and at rest (AES-256)`,
            textI18n: '@@privacy.security.encryption',
          },
          {
            text: $localize`:@@privacy.security.assessments:Regular security assessments and penetration testing`,
            textI18n: '@@privacy.security.assessments',
          },
          {
            text: $localize`:@@privacy.security.access_controls:Access controls and multi-factor authentication`,
            textI18n: '@@privacy.security.access_controls',
          },
          {
            text: $localize`:@@privacy.security.data_centers:Secure data centers with physical and network security`,
            textI18n: '@@privacy.security.data_centers',
          },
          {
            text: $localize`:@@privacy.security.training:Employee training on data protection and security`,
            textI18n: '@@privacy.security.training',
          },
          {
            text: $localize`:@@privacy.security.incident_response:Incident response procedures and breach notification protocols`,
            textI18n: '@@privacy.security.incident_response',
          },
        ],
      },
      {
        id: 'third-party',
        title: $localize`:@@privacy.third_party.title:11. THIRD-PARTY WEBSITES/APPLICATIONS`,
        titleI18n: '@@privacy.third_party.title',
        content: $localize`:@@privacy.third_party.content:Our Services may contain links to third-party websites or integrate with third-party applications. This Privacy Policy does not apply to those third-party services. We encourage you to review their privacy policies before providing any personal information.`,

        contentI18n: '@@privacy.third_party.content',
      },
      {
        id: 'children',
        title: "12. CHILDREN'S INFORMATION",
        titleI18n: '@@privacy.children.title',
        content: $localize`:@@privacy.children.content:Our Services are not intended for children under 13 years of age (or 16 in the European Economic Area). We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete it promptly. If you believe we have collected information from a child, please contact us immediately.`,

        contentI18n: '@@privacy.children.content',
      },
      {
        id: 'changes',
        title: $localize`:@@privacy.changes.title:13. CHANGES TO OUR PRIVACY POLICY`,
        titleI18n: '@@privacy.changes.title',
        content: $localize`:@@privacy.changes.content:We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of material changes by posting the updated policy on this page and updating the \"Effective Date\" at the top. For significant changes, we may provide additional notice such as an email notification. Your continued use of our Services after the changes take effect constitutes acceptance of the updated policy.`,

        contentI18n: '@@privacy.changes.content',
      },
      {
        id: 'contact',
        title: $localize`:@@privacy.contact.title:14. CONTACT US`,
        titleI18n: '@@privacy.contact.title',
        content: $localize`:@@privacy.contact.content:If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:`,

        contentI18n: '@@privacy.contact.content',
      },
    ];
  }
}
