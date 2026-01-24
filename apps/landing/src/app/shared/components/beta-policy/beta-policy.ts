import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LegalDocumentTemplate,
  LegalSection,
  LegalNavItem,
} from '../legal-document-template/legal-document-template';

@Component({
  selector: 'app-beta-policy',
  standalone: true,
  imports: [CommonModule, LegalDocumentTemplate],
  templateUrl: './beta-policy.html',
  styleUrl: './beta-policy.css',
})
export class BetaPolicy implements OnInit {
  protected title = 'IDEM Legal';
  protected subtitle =
    'Beta Program Terms and Conditions for IDEM AI-Powered Project Management Platform';
  protected effectiveDate = 'October 10, 2025';
  protected showVersionSelector = false;
  protected versions: string[] = [];
  protected currentVersion = '';

  protected navigation: LegalNavItem[] = [
    { id: 'overview', title: '1. BETA PROGRAM OVERVIEW', titleI18n: '@@beta.nav.overview' },
    { id: 'nature', title: '2. BETA SOFTWARE NATURE', titleI18n: '@@beta.nav.nature' },
    { id: 'limitations', title: '3. USAGE LIMITATIONS', titleI18n: '@@beta.nav.limitations' },
    { id: 'data-privacy', title: '4. DATA AND PRIVACY', titleI18n: '@@beta.nav.data_privacy' },
    { id: 'feedback', title: '5. FEEDBACK AND REPORTING', titleI18n: '@@beta.nav.feedback' },
    {
      id: 'confidentiality',
      title: $localize`:@@beta.nav.confidentiality:6. CONFIDENTIALITY`,
      titleI18n: '@@beta.nav.confidentiality',
    },
    { id: 'duration', title: '7. PROGRAM DURATION', titleI18n: '@@beta.nav.duration' },
    { id: 'warranty', title: '8. NO WARRANTY', titleI18n: '@@beta.nav.warranty' },
    {
      id: 'intellectual-property',
      title: $localize`:@@beta.nav.intellectual_property:9. INTELLECTUAL PROPERTY`,
      titleI18n: '@@beta.nav.intellectual_property',
    },
    { id: 'support', title: '10. BETA SUPPORT', titleI18n: '@@beta.nav.support' },
    { id: 'transition', title: '11. TRANSITION TO RELEASE', titleI18n: '@@beta.nav.transition' },
    { id: 'contact', title: '12. CONTACT', titleI18n: '@@beta.nav.contact' },
  ];

  protected sections: LegalSection[] = [];

  ngOnInit(): void {
    this.sections = [
      {
        id: 'overview',
        title: $localize`:@@beta.overview.title:1. BETA PROGRAM OVERVIEW`,
        titleI18n: '@@beta.overview.title',
        content: $localize`:@@beta.overview.content:Welcome to the IDEM Beta Program. By participating in this beta program, you agree to test our AI-powered project management platform and provide feedback to help us improve the service before its general release. This beta program allows you to access pre-release features and functionality that may not be available in the production version.`,

        contentI18n: '@@beta.overview.content',
      },
      {
        id: 'nature',
        title: $localize`:@@beta.nature.title:2. BETA SOFTWARE NATURE`,
        titleI18n: '@@beta.nature.title',
        content: $localize`:@@beta.nature.content:You acknowledge and understand that the beta software has the following characteristics:`,

        contentI18n: '@@beta.nature.content',
        list: [
          {
            text: $localize`:@@beta.nature.prerelease:Is pre-release software that may contain bugs, errors, defects, and security vulnerabilities`,
            textI18n: '@@beta.nature.prerelease',
          },
          {
            text: $localize`:@@beta.nature.malfunction:May not function as intended or may fail to function entirely`,
            textI18n: '@@beta.nature.malfunction',
          },
          {
            text: $localize`:@@beta.nature.crashes:May cause system crashes, data loss, corruption, or other unexpected issues`,
            textI18n: '@@beta.nature.crashes',
          },
          {
            text: $localize`:@@beta.nature.testing_only:Is provided for testing, evaluation, and feedback purposes only`,
            textI18n: '@@beta.nature.testing_only',
          },
          {
            text: $localize`:@@beta.nature.limited_features:May have limited features, incomplete functionality, or missing documentation`,
            textI18n: '@@beta.nature.limited_features',
          },
          {
            text: $localize`:@@beta.nature.subject_to_change:Is subject to significant changes, modifications, or removal without notice`,
            textI18n: '@@beta.nature.subject_to_change',
          },
          {
            text: $localize`:@@beta.nature.performance_issues:May have performance issues, slow response times, or service interruptions`,
            textI18n: '@@beta.nature.performance_issues',
          },
        ],
        warning: {
          type: 'warning',
          icon: '⚠️',
          title: $localize`:@@beta.nature.warning.title:Important Beta Software Warning`,
          titleI18n: '@@beta.nature.warning.title',
          content: $localize`:@@beta.nature.warning.content:Beta software is inherently unstable and should not be used for production purposes, critical business operations, or with sensitive data. Always maintain backups of important information.`,

          contentI18n: '@@beta.nature.warning.content',
        },
      },
      {
        id: 'limitations',
        title: $localize`:@@beta.limitations.title:3. USAGE LIMITATIONS AND RESTRICTIONS`,
        titleI18n: '@@beta.limitations.title',
        content: $localize`:@@beta.limitations.content:During the beta period, the following limitations and restrictions apply:`,
        contentI18n: '@@beta.limitations.content',
        subsections: [
          {
            title: $localize`:@@beta.limitations.access.title:3.1 Beta Access Limitations`,
            titleI18n: '@@beta.limitations.access.title',
            content: $localize`:@@beta.limitations.access.content:Your access to the beta program is subject to the following conditions:`,
            contentI18n: '@@beta.limitations.access.content',
            list: [
              {
                text: $localize`:@@beta.limitations.access.limited:Beta access is limited, invitation-only, and may be revoked at any time without notice`,
                textI18n: '@@beta.limitations.access.limited',
              },
              {
                text: $localize`:@@beta.limitations.access.quotas:Usage quotas, rate limits, and resource restrictions may apply`,
                textI18n: '@@beta.limitations.access.quotas',
              },
              {
                text: $localize`:@@beta.limitations.access.restricted_features:Certain features may be restricted, disabled, or unavailable`,
                textI18n: '@@beta.limitations.access.restricted_features',
              },
              {
                text: $localize`:@@beta.limitations.access.no_guarantee:Service availability, uptime, and performance are not guaranteed`,
                textI18n: '@@beta.limitations.access.no_guarantee',
              },
              {
                text: $localize`:@@beta.limitations.access.account_reset:Beta accounts may be reset, modified, or deleted without notice`,
                textI18n: '@@beta.limitations.access.account_reset',
              },
            ],
          },
          {
            title: $localize`:@@beta.limitations.prohibited.title:3.2 Prohibited Uses`,
            titleI18n: '@@beta.limitations.prohibited.title',
            content: $localize`:@@beta.limitations.prohibited.content:During the beta period, you explicitly agree NOT to:`,
            contentI18n: '@@beta.limitations.prohibited.content',
            list: [
              {
                text: $localize`:@@beta.limitations.prohibited.production:Use the beta software for production, commercial, or revenue-generating purposes`,
                textI18n: '@@beta.limitations.prohibited.production',
              },
              {
                text: $localize`:@@beta.limitations.prohibited.sensitive_data:Process, store, or transmit sensitive, confidential, or critical business data`,
                textI18n: '@@beta.limitations.prohibited.sensitive_data',
              },
              {
                text: $localize`:@@beta.limitations.prohibited.mission_critical:Rely on the beta software for mission-critical operations or time-sensitive tasks`,
                textI18n: '@@beta.limitations.prohibited.mission_critical',
              },
              {
                text: $localize`:@@beta.limitations.prohibited.reverse_engineer:Reverse engineer, decompile, disassemble, or attempt to derive source code`,
                textI18n: '@@beta.limitations.prohibited.reverse_engineer',
              },
              {
                text: $localize`:@@beta.limitations.prohibited.share_access:Share, transfer, or sublicense your beta access credentials with others`,
                textI18n: '@@beta.limitations.prohibited.share_access',
              },
              {
                text: $localize`:@@beta.limitations.prohibited.circumvent:Attempt to circumvent usage limits, security measures, or access controls`,
                textI18n: '@@beta.limitations.prohibited.circumvent',
              },
              {
                text: $localize`:@@beta.limitations.prohibited.violate_laws:Use the beta software to violate any laws, regulations, or third-party rights`,
                textI18n: '@@beta.limitations.prohibited.violate_laws',
              },
            ],
          },
        ],
      },
      {
        id: 'data-privacy',
        title: $localize`:@@beta.data_privacy.title:4. DATA AND PRIVACY CONSIDERATIONS`,
        titleI18n: '@@beta.data_privacy.title',
        content: $localize`:@@beta.data_privacy.content:Beta software involves special data handling and privacy considerations:`,
        contentI18n: '@@beta.data_privacy.content',
        warning: {
          type: 'error',
          icon: '🚨',
          title: $localize`:@@beta.data_privacy.warning.title:Critical Data Warning`,
          titleI18n: '@@beta.data_privacy.warning.title',
          content: $localize`:@@beta.data_privacy.warning.content:Beta software may be unstable and could result in complete data loss. DO NOT input critical, sensitive, confidential, or irreplaceable data during the beta period. Always maintain external backups of important information.`,

          contentI18n: '@@beta.data_privacy.warning.content',
        },
        list: [
          {
            text: $localize`:@@beta.data_privacy.data_deletion:Beta data may be deleted, reset, or corrupted at any time without notice or recovery`,
            textI18n: '@@beta.data_privacy.data_deletion',
          },
          {
            text: $localize`:@@beta.data_privacy.no_backup:Data backup, recovery, and retention services are not guaranteed or provided`,
            textI18n: '@@beta.data_privacy.no_backup',
          },
          {
            text: $localize`:@@beta.data_privacy.monitoring:Your beta usage data, interactions, and feedback may be monitored and collected`,
            textI18n: '@@beta.data_privacy.monitoring',
          },
          {
            text: $localize`:@@beta.data_privacy.error_logs:Error logs, crash reports, and diagnostic data may be automatically collected`,
            textI18n: '@@beta.data_privacy.error_logs',
          },
          {
            text: $localize`:@@beta.data_privacy.different_policies:Beta data is not subject to the same security, privacy, or retention policies as production data`,
            textI18n: '@@beta.data_privacy.different_policies',
          },
          {
            text: $localize`:@@beta.data_privacy.data_usage:We may use beta data to improve our services, train AI models, and develop new features`,
            textI18n: '@@beta.data_privacy.data_usage',
          },
          {
            text: $localize`:@@beta.data_privacy.third_party_sharing:Beta data may be shared with third-party service providers for testing and development`,
            textI18n: '@@beta.data_privacy.third_party_sharing',
          },
        ],
      },
      {
        id: 'feedback',
        title: $localize`:@@beta.feedback.title:5. FEEDBACK AND REPORTING OBLIGATIONS`,
        titleI18n: '@@beta.feedback.title',
        content: $localize`:@@beta.feedback.content:As a beta participant, you agree to actively participate in the following ways:`,
        contentI18n: '@@beta.feedback.content',
        list: [
          {
            text: $localize`:@@beta.feedback.constructive:Provide constructive, detailed feedback about your experience and observations`,
            textI18n: '@@beta.feedback.constructive',
          },
          {
            text: $localize`:@@beta.feedback.report_bugs:Report bugs, errors, crashes, and issues promptly with reproduction steps`,
            textI18n: '@@beta.feedback.report_bugs',
          },
          {
            text: $localize`:@@beta.feedback.surveys:Participate in surveys, feedback sessions, and user research when requested`,
            textI18n: '@@beta.feedback.surveys',
          },
          {
            text: $localize`:@@beta.feedback.test_features:Test specific features, workflows, and scenarios as directed by our team`,
            textI18n: '@@beta.feedback.test_features',
          },
          {
            text: $localize`:@@beta.feedback.communication_channels:Communicate through designated beta feedback channels and platforms`,
            textI18n: '@@beta.feedback.communication_channels',
          },
          {
            text: $localize`:@@beta.feedback.suggestions:Provide suggestions for improvements, new features, and enhancements`,
            textI18n: '@@beta.feedback.suggestions',
          },
          {
            text: $localize`:@@beta.feedback.document_use_cases:Document and share use cases, workflows, and integration scenarios`,
            textI18n: '@@beta.feedback.document_use_cases',
          },
        ],
      },
      {
        id: 'confidentiality',
        title: $localize`:@@beta.confidentiality.title:6. CONFIDENTIALITY AND NON-DISCLOSURE`,
        titleI18n: '@@beta.confidentiality.title',
        content: $localize`:@@beta.confidentiality.content:The beta software, your participation, and all related information are strictly confidential. You agree to:`,

        contentI18n: '@@beta.confidentiality.content',
        list: [
          {
            text: $localize`:@@beta.confidentiality.keep_confidential:Keep all beta software features, capabilities, and functionality confidential`,
            textI18n: '@@beta.confidentiality.keep_confidential',
          },
          {
            text: $localize`:@@beta.confidentiality.no_disclosure:Not disclose beta program details, information, or materials to unauthorized parties`,
            textI18n: '@@beta.confidentiality.no_disclosure',
          },
          {
            text: $localize`:@@beta.confidentiality.no_publishing:Not publish reviews, blog posts, screenshots, videos, or demos without written permission`,
            textI18n: '@@beta.confidentiality.no_publishing',
          },
          {
            text: $localize`:@@beta.confidentiality.no_sharing:Not share beta access, credentials, or invitation codes with others`,
            textI18n: '@@beta.confidentiality.no_sharing',
          },
          {
            text: $localize`:@@beta.confidentiality.no_public_discussion:Not discuss beta features publicly on social media, forums, or other platforms`,
            textI18n: '@@beta.confidentiality.no_public_discussion',
          },
          {
            text: $localize`:@@beta.confidentiality.additional_agreements:Respect any additional confidentiality agreements or non-disclosure requirements`,
            textI18n: '@@beta.confidentiality.additional_agreements',
          },
          {
            text: $localize`:@@beta.confidentiality.return_materials:Return or destroy all beta materials upon request or program termination`,
            textI18n: '@@beta.confidentiality.return_materials',
          },
        ],
      },
      {
        id: 'duration',
        title: $localize`:@@beta.duration.title:7. BETA PROGRAM DURATION AND TERMINATION`,
        titleI18n: '@@beta.duration.title',
        content: $localize`:@@beta.duration.content:The beta program operates under the following terms:`,
        contentI18n: '@@beta.duration.content',
        list: [
          {
            text: $localize`:@@beta.duration.no_guarantee:Has no guaranteed duration, timeline, or end date and may conclude at any time`,
            textI18n: '@@beta.duration.no_guarantee',
          },
          {
            text: $localize`:@@beta.duration.termination:May be terminated by either party at any time without notice or explanation`,
            textI18n: '@@beta.duration.termination',
          },
          {
            text: $localize`:@@beta.duration.auto_end:Will automatically end upon general release, public launch, or program cancellation`,
            textI18n: '@@beta.duration.auto_end',
          },
          {
            text: $localize`:@@beta.duration.loss_of_access:May result in immediate loss of access to beta features, data, and materials`,
            textI18n: '@@beta.duration.loss_of_access',
          },
          {
            text: $localize`:@@beta.duration.cease_use:Requires you to cease all use and delete downloaded materials upon termination`,
            textI18n: '@@beta.duration.cease_use',
          },
          {
            text: $localize`:@@beta.duration.no_guarantee_transition:Does not guarantee transition to the production version or continued access`,
            textI18n: '@@beta.duration.no_guarantee_transition',
          },
        ],
      },
      {
        id: 'warranty',
        title: $localize`:@@beta.warranty.title:8. NO WARRANTY AND LIABILITY LIMITATIONS`,
        titleI18n: '@@beta.warranty.title',
        content: $localize`:@@beta.warranty.content:Beta software is provided under the following warranty and liability terms:`,
        contentI18n: '@@beta.warranty.content',
        warning: {
          type: 'error',
          icon: '⚠️',
          title: $localize`:@@beta.warranty.disclaimer.title:No Warranty Disclaimer`,
          titleI18n: '@@beta.warranty.disclaimer.title',
          content: $localize`:@@beta.warranty.disclaimer.content:BETA SOFTWARE IS PROVIDED \"AS IS\" WITH ABSOLUTELY NO WARRANTY OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, TITLE, QUIET ENJOYMENT, ACCURACY, AND INTEGRATION. YOU USE THE BETA SOFTWARE ENTIRELY AT YOUR OWN RISK.`,

          contentI18n: '@@beta.warranty.disclaimer.content',
        },
        list: [
          {
            text: $localize`:@@beta.warranty.no_liability:We are not liable for any damages, losses, or issues arising from beta software use`,
            textI18n: '@@beta.warranty.no_liability',
          },
          {
            text: $localize`:@@beta.warranty.no_guarantee_functionality:We do not guarantee functionality, performance, availability, or reliability`,
            textI18n: '@@beta.warranty.no_guarantee_functionality',
          },
          {
            text: $localize`:@@beta.warranty.no_responsibility_data_loss:We are not responsible for data loss, corruption, or security breaches`,
            textI18n: '@@beta.warranty.no_responsibility_data_loss',
          },
          {
            text: $localize`:@@beta.warranty.disclaim_indirect_damages:We disclaim liability for indirect, incidental, consequential, or punitive damages`,
            textI18n: '@@beta.warranty.disclaim_indirect_damages',
          },
          {
            text: $localize`:@@beta.warranty.maximum_liability:Maximum liability, if any, is limited to the amount you paid for beta access (typically $0)`,
            textI18n: '@@beta.warranty.maximum_liability',
          },
        ],
      },
      {
        id: 'intellectual-property',
        title: $localize`:@@beta.intellectual_property.title:9. INTELLECTUAL PROPERTY RIGHTS`,
        titleI18n: '@@beta.intellectual_property.title',
        content: $localize`:@@beta.intellectual_property.content:All intellectual property rights in the beta software remain exclusively with IDEM. Your feedback, suggestions, and contributions may be used by us to improve the software without compensation or attribution. You grant us a perpetual, worldwide, royalty-free license to use any feedback you provide.`,

        contentI18n: '@@beta.intellectual_property.content',
      },
      {
        id: 'support',
        title: $localize`:@@beta.support.title:10. BETA-SPECIFIC SUPPORT`,
        titleI18n: '@@beta.support.title',
        content: $localize`:@@beta.support.content:Beta support is provided on a best-effort, as-available basis:`,
        contentI18n: '@@beta.support.content',
        list: [
          {
            text: $localize`:@@beta.support.no_guarantee:No guaranteed response times, service level agreements, or support commitments`,
            textI18n: '@@beta.support.no_guarantee',
          },
          {
            text: $localize`:@@beta.support.limited_channels:Support may be limited to beta-specific channels, forums, or communication methods`,
            textI18n: '@@beta.support.limited_channels',
          },
          {
            text: $localize`:@@beta.support.incomplete_docs:Documentation may be incomplete, outdated, inaccurate, or unavailable`,
            textI18n: '@@beta.support.incomplete_docs',
          },
          {
            text: $localize`:@@beta.support.limited_training:Training, onboarding, and educational resources may be limited or non-existent`,
            textI18n: '@@beta.support.limited_training',
          },
          {
            text: $localize`:@@beta.support.no_priority:Priority support is not available for beta participants`,
            textI18n: '@@beta.support.no_priority',
          },
        ],
      },
      {
        id: 'transition',
        title: $localize`:@@beta.transition.title:11. TRANSITION TO GENERAL RELEASE`,
        titleI18n: '@@beta.transition.title',
        content: $localize`:@@beta.transition.content:When the software transitions from beta to general release, the following applies:`,

        contentI18n: '@@beta.transition.content',
        list: [
          {
            text: $localize`:@@beta.transition.auto_terminate:Beta access will automatically terminate upon general release announcement`,
            textI18n: '@@beta.transition.auto_terminate',
          },
          {
            text: $localize`:@@beta.transition.new_account:You may need to create a new account or re-register for the production version`,
            textI18n: '@@beta.transition.new_account',
          },
          {
            text: $localize`:@@beta.transition.no_data_migration:Beta data may not be migrated, transferred, or preserved in the production system`,
            textI18n: '@@beta.transition.no_data_migration',
          },
          {
            text: $localize`:@@beta.transition.new_terms:New terms of service, privacy policy, and pricing will apply to the production version`,
            textI18n: '@@beta.transition.new_terms',
          },
          {
            text: $localize`:@@beta.transition.different_features:Pricing, features, functionality, and availability may differ from the beta version`,
            textI18n: '@@beta.transition.different_features',
          },
          {
            text: $localize`:@@beta.transition.no_guarantee_access:Beta participants are not guaranteed access, discounts, or special treatment`,
            textI18n: '@@beta.transition.no_guarantee_access',
          },
          {
            text: $localize`:@@beta.transition.right_to_discontinue:We reserve the right to discontinue the product without releasing a production version`,
            textI18n: '@@beta.transition.right_to_discontinue',
          },
        ],
      },
      {
        id: 'contact',
        title: $localize`:@@beta.contact.title:12. CONTACT AND SUPPORT INFORMATION`,
        titleI18n: '@@beta.contact.title',
        content: $localize`:@@beta.contact.content:For beta program questions, support, feedback, or concerns, please contact us through the following channels:`,

        contentI18n: '@@beta.contact.content',
      },
    ];
  }
}
