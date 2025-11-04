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
      title: '6. CONFIDENTIALITY',
      titleI18n: '@@beta.nav.confidentiality',
    },
    { id: 'duration', title: '7. PROGRAM DURATION', titleI18n: '@@beta.nav.duration' },
    { id: 'warranty', title: '8. NO WARRANTY', titleI18n: '@@beta.nav.warranty' },
    {
      id: 'intellectual-property',
      title: '9. INTELLECTUAL PROPERTY',
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
        title: '1. BETA PROGRAM OVERVIEW',
        titleI18n: '@@beta.overview.title',
        content:
          'Welcome to the IDEM Beta Program. By participating in this beta program, you agree to test our AI-powered project management platform and provide feedback to help us improve the service before its general release. This beta program allows you to access pre-release features and functionality that may not be available in the production version.',
        contentI18n: '@@beta.overview.content',
      },
      {
        id: 'nature',
        title: '2. BETA SOFTWARE NATURE',
        titleI18n: '@@beta.nature.title',
        content:
          'You acknowledge and understand that the beta software has the following characteristics:',
        contentI18n: '@@beta.nature.content',
        list: [
          {
            text: 'Is pre-release software that may contain bugs, errors, defects, and security vulnerabilities',
            textI18n: '@@beta.nature.prerelease',
          },
          {
            text: 'May not function as intended or may fail to function entirely',
            textI18n: '@@beta.nature.malfunction',
          },
          {
            text: 'May cause system crashes, data loss, corruption, or other unexpected issues',
            textI18n: '@@beta.nature.crashes',
          },
          {
            text: 'Is provided for testing, evaluation, and feedback purposes only',
            textI18n: '@@beta.nature.testing_only',
          },
          {
            text: 'May have limited features, incomplete functionality, or missing documentation',
            textI18n: '@@beta.nature.limited_features',
          },
          {
            text: 'Is subject to significant changes, modifications, or removal without notice',
            textI18n: '@@beta.nature.subject_to_change',
          },
          {
            text: 'May have performance issues, slow response times, or service interruptions',
            textI18n: '@@beta.nature.performance_issues',
          },
        ],
        warning: {
          type: 'warning',
          icon: '⚠️',
          title: 'Important Beta Software Warning',
          titleI18n: '@@beta.nature.warning.title',
          content:
            'Beta software is inherently unstable and should not be used for production purposes, critical business operations, or with sensitive data. Always maintain backups of important information.',
          contentI18n: '@@beta.nature.warning.content',
        },
      },
      {
        id: 'limitations',
        title: '3. USAGE LIMITATIONS AND RESTRICTIONS',
        titleI18n: '@@beta.limitations.title',
        content: 'During the beta period, the following limitations and restrictions apply:',
        contentI18n: '@@beta.limitations.content',
        subsections: [
          {
            title: '3.1 Beta Access Limitations',
            titleI18n: '@@beta.limitations.access.title',
            content: 'Your access to the beta program is subject to the following conditions:',
            contentI18n: '@@beta.limitations.access.content',
            list: [
              {
                text: 'Beta access is limited, invitation-only, and may be revoked at any time without notice',
                textI18n: '@@beta.limitations.access.limited',
              },
              {
                text: 'Usage quotas, rate limits, and resource restrictions may apply',
                textI18n: '@@beta.limitations.access.quotas',
              },
              {
                text: 'Certain features may be restricted, disabled, or unavailable',
                textI18n: '@@beta.limitations.access.restricted_features',
              },
              {
                text: 'Service availability, uptime, and performance are not guaranteed',
                textI18n: '@@beta.limitations.access.no_guarantee',
              },
              {
                text: 'Beta accounts may be reset, modified, or deleted without notice',
                textI18n: '@@beta.limitations.access.account_reset',
              },
            ],
          },
          {
            title: '3.2 Prohibited Uses',
            titleI18n: '@@beta.limitations.prohibited.title',
            content: 'During the beta period, you explicitly agree NOT to:',
            contentI18n: '@@beta.limitations.prohibited.content',
            list: [
              {
                text: 'Use the beta software for production, commercial, or revenue-generating purposes',
                textI18n: '@@beta.limitations.prohibited.production',
              },
              {
                text: 'Process, store, or transmit sensitive, confidential, or critical business data',
                textI18n: '@@beta.limitations.prohibited.sensitive_data',
              },
              {
                text: 'Rely on the beta software for mission-critical operations or time-sensitive tasks',
                textI18n: '@@beta.limitations.prohibited.mission_critical',
              },
              {
                text: 'Reverse engineer, decompile, disassemble, or attempt to derive source code',
                textI18n: '@@beta.limitations.prohibited.reverse_engineer',
              },
              {
                text: 'Share, transfer, or sublicense your beta access credentials with others',
                textI18n: '@@beta.limitations.prohibited.share_access',
              },
              {
                text: 'Attempt to circumvent usage limits, security measures, or access controls',
                textI18n: '@@beta.limitations.prohibited.circumvent',
              },
              {
                text: 'Use the beta software to violate any laws, regulations, or third-party rights',
                textI18n: '@@beta.limitations.prohibited.violate_laws',
              },
            ],
          },
        ],
      },
      {
        id: 'data-privacy',
        title: '4. DATA AND PRIVACY CONSIDERATIONS',
        titleI18n: '@@beta.data_privacy.title',
        content: 'Beta software involves special data handling and privacy considerations:',
        contentI18n: '@@beta.data_privacy.content',
        warning: {
          type: 'error',
          icon: '🚨',
          title: 'Critical Data Warning',
          titleI18n: '@@beta.data_privacy.warning.title',
          content:
            'Beta software may be unstable and could result in complete data loss. DO NOT input critical, sensitive, confidential, or irreplaceable data during the beta period. Always maintain external backups of important information.',
          contentI18n: '@@beta.data_privacy.warning.content',
        },
        list: [
          {
            text: 'Beta data may be deleted, reset, or corrupted at any time without notice or recovery',
            textI18n: '@@beta.data_privacy.data_deletion',
          },
          {
            text: 'Data backup, recovery, and retention services are not guaranteed or provided',
            textI18n: '@@beta.data_privacy.no_backup',
          },
          {
            text: 'Your beta usage data, interactions, and feedback may be monitored and collected',
            textI18n: '@@beta.data_privacy.monitoring',
          },
          {
            text: 'Error logs, crash reports, and diagnostic data may be automatically collected',
            textI18n: '@@beta.data_privacy.error_logs',
          },
          {
            text: 'Beta data is not subject to the same security, privacy, or retention policies as production data',
            textI18n: '@@beta.data_privacy.different_policies',
          },
          {
            text: 'We may use beta data to improve our services, train AI models, and develop new features',
            textI18n: '@@beta.data_privacy.data_usage',
          },
          {
            text: 'Beta data may be shared with third-party service providers for testing and development',
            textI18n: '@@beta.data_privacy.third_party_sharing',
          },
        ],
      },
      {
        id: 'feedback',
        title: '5. FEEDBACK AND REPORTING OBLIGATIONS',
        titleI18n: '@@beta.feedback.title',
        content: 'As a beta participant, you agree to actively participate in the following ways:',
        contentI18n: '@@beta.feedback.content',
        list: [
          {
            text: 'Provide constructive, detailed feedback about your experience and observations',
            textI18n: '@@beta.feedback.constructive',
          },
          {
            text: 'Report bugs, errors, crashes, and issues promptly with reproduction steps',
            textI18n: '@@beta.feedback.report_bugs',
          },
          {
            text: 'Participate in surveys, feedback sessions, and user research when requested',
            textI18n: '@@beta.feedback.surveys',
          },
          {
            text: 'Test specific features, workflows, and scenarios as directed by our team',
            textI18n: '@@beta.feedback.test_features',
          },
          {
            text: 'Communicate through designated beta feedback channels and platforms',
            textI18n: '@@beta.feedback.communication_channels',
          },
          {
            text: 'Provide suggestions for improvements, new features, and enhancements',
            textI18n: '@@beta.feedback.suggestions',
          },
          {
            text: 'Document and share use cases, workflows, and integration scenarios',
            textI18n: '@@beta.feedback.document_use_cases',
          },
        ],
      },
      {
        id: 'confidentiality',
        title: '6. CONFIDENTIALITY AND NON-DISCLOSURE',
        titleI18n: '@@beta.confidentiality.title',
        content:
          'The beta software, your participation, and all related information are strictly confidential. You agree to:',
        contentI18n: '@@beta.confidentiality.content',
        list: [
          {
            text: 'Keep all beta software features, capabilities, and functionality confidential',
            textI18n: '@@beta.confidentiality.keep_confidential',
          },
          {
            text: 'Not disclose beta program details, information, or materials to unauthorized parties',
            textI18n: '@@beta.confidentiality.no_disclosure',
          },
          {
            text: 'Not publish reviews, blog posts, screenshots, videos, or demos without written permission',
            textI18n: '@@beta.confidentiality.no_publishing',
          },
          {
            text: 'Not share beta access, credentials, or invitation codes with others',
            textI18n: '@@beta.confidentiality.no_sharing',
          },
          {
            text: 'Not discuss beta features publicly on social media, forums, or other platforms',
            textI18n: '@@beta.confidentiality.no_public_discussion',
          },
          {
            text: 'Respect any additional confidentiality agreements or non-disclosure requirements',
            textI18n: '@@beta.confidentiality.additional_agreements',
          },
          {
            text: 'Return or destroy all beta materials upon request or program termination',
            textI18n: '@@beta.confidentiality.return_materials',
          },
        ],
      },
      {
        id: 'duration',
        title: '7. BETA PROGRAM DURATION AND TERMINATION',
        titleI18n: '@@beta.duration.title',
        content: 'The beta program operates under the following terms:',
        contentI18n: '@@beta.duration.content',
        list: [
          {
            text: 'Has no guaranteed duration, timeline, or end date and may conclude at any time',
            textI18n: '@@beta.duration.no_guarantee',
          },
          {
            text: 'May be terminated by either party at any time without notice or explanation',
            textI18n: '@@beta.duration.termination',
          },
          {
            text: 'Will automatically end upon general release, public launch, or program cancellation',
            textI18n: '@@beta.duration.auto_end',
          },
          {
            text: 'May result in immediate loss of access to beta features, data, and materials',
            textI18n: '@@beta.duration.loss_of_access',
          },
          {
            text: 'Requires you to cease all use and delete downloaded materials upon termination',
            textI18n: '@@beta.duration.cease_use',
          },
          {
            text: 'Does not guarantee transition to the production version or continued access',
            textI18n: '@@beta.duration.no_guarantee_transition',
          },
        ],
      },
      {
        id: 'warranty',
        title: '8. NO WARRANTY AND LIABILITY LIMITATIONS',
        titleI18n: '@@beta.warranty.title',
        content: 'Beta software is provided under the following warranty and liability terms:',
        contentI18n: '@@beta.warranty.content',
        warning: {
          type: 'error',
          icon: '⚠️',
          title: 'No Warranty Disclaimer',
          titleI18n: '@@beta.warranty.disclaimer.title',
          content:
            'BETA SOFTWARE IS PROVIDED "AS IS" WITH ABSOLUTELY NO WARRANTY OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, TITLE, QUIET ENJOYMENT, ACCURACY, AND INTEGRATION. YOU USE THE BETA SOFTWARE ENTIRELY AT YOUR OWN RISK.',
          contentI18n: '@@beta.warranty.disclaimer.content',
        },
        list: [
          {
            text: 'We are not liable for any damages, losses, or issues arising from beta software use',
            textI18n: '@@beta.warranty.no_liability',
          },
          {
            text: 'We do not guarantee functionality, performance, availability, or reliability',
            textI18n: '@@beta.warranty.no_guarantee_functionality',
          },
          {
            text: 'We are not responsible for data loss, corruption, or security breaches',
            textI18n: '@@beta.warranty.no_responsibility_data_loss',
          },
          {
            text: 'We disclaim liability for indirect, incidental, consequential, or punitive damages',
            textI18n: '@@beta.warranty.disclaim_indirect_damages',
          },
          {
            text: 'Maximum liability, if any, is limited to the amount you paid for beta access (typically $0)',
            textI18n: '@@beta.warranty.maximum_liability',
          },
        ],
      },
      {
        id: 'intellectual-property',
        title: '9. INTELLECTUAL PROPERTY RIGHTS',
        titleI18n: '@@beta.intellectual_property.title',
        content:
          'All intellectual property rights in the beta software remain exclusively with IDEM. Your feedback, suggestions, and contributions may be used by us to improve the software without compensation or attribution. You grant us a perpetual, worldwide, royalty-free license to use any feedback you provide.',
        contentI18n: '@@beta.intellectual_property.content',
      },
      {
        id: 'support',
        title: '10. BETA-SPECIFIC SUPPORT',
        titleI18n: '@@beta.support.title',
        content: 'Beta support is provided on a best-effort, as-available basis:',
        contentI18n: '@@beta.support.content',
        list: [
          {
            text: 'No guaranteed response times, service level agreements, or support commitments',
            textI18n: '@@beta.support.no_guarantee',
          },
          {
            text: 'Support may be limited to beta-specific channels, forums, or communication methods',
            textI18n: '@@beta.support.limited_channels',
          },
          {
            text: 'Documentation may be incomplete, outdated, inaccurate, or unavailable',
            textI18n: '@@beta.support.incomplete_docs',
          },
          {
            text: 'Training, onboarding, and educational resources may be limited or non-existent',
            textI18n: '@@beta.support.limited_training',
          },
          {
            text: 'Priority support is not available for beta participants',
            textI18n: '@@beta.support.no_priority',
          },
        ],
      },
      {
        id: 'transition',
        title: '11. TRANSITION TO GENERAL RELEASE',
        titleI18n: '@@beta.transition.title',
        content:
          'When the software transitions from beta to general release, the following applies:',
        contentI18n: '@@beta.transition.content',
        list: [
          {
            text: 'Beta access will automatically terminate upon general release announcement',
            textI18n: '@@beta.transition.auto_terminate',
          },
          {
            text: 'You may need to create a new account or re-register for the production version',
            textI18n: '@@beta.transition.new_account',
          },
          {
            text: 'Beta data may not be migrated, transferred, or preserved in the production system',
            textI18n: '@@beta.transition.no_data_migration',
          },
          {
            text: 'New terms of service, privacy policy, and pricing will apply to the production version',
            textI18n: '@@beta.transition.new_terms',
          },
          {
            text: 'Pricing, features, functionality, and availability may differ from the beta version',
            textI18n: '@@beta.transition.different_features',
          },
          {
            text: 'Beta participants are not guaranteed access, discounts, or special treatment',
            textI18n: '@@beta.transition.no_guarantee_access',
          },
          {
            text: 'We reserve the right to discontinue the product without releasing a production version',
            textI18n: '@@beta.transition.right_to_discontinue',
          },
        ],
      },
      {
        id: 'contact',
        title: '12. CONTACT AND SUPPORT INFORMATION',
        titleI18n: '@@beta.contact.title',
        content:
          'For beta program questions, support, feedback, or concerns, please contact us through the following channels:',
        contentI18n: '@@beta.contact.content',
      },
    ];
  }
}
