import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LegalDocumentTemplate,
  LegalNavItem,
  LegalSection,
} from '../legal-document-template/legal-document-template';

/**
 * Politique de confidentialité du programme Idem Builders.
 *
 * Elle décrit exactement ce que stocke la collection `builder_applications`
 * (API IDEM) et ce que montre la vitrine : un champ ajouté là-bas sans être
 * décrit ici rend la politique fausse. Acceptée avec les conditions de
 * participation, sous la même version (`BUILDERS_LEGAL_VERSION`).
 *
 * Généré depuis une source unique fr/en : modifier les deux langues ensemble.
 */
@Component({
  selector: 'app-builders-privacy',
  standalone: true,
  imports: [CommonModule, LegalDocumentTemplate],
  templateUrl: './builders-privacy.html',
})
export class BuildersPrivacy implements OnInit {
  protected title = 'IDEM Legal';
  protected subtitle = $localize`:@@buildersPrivacy.subtitle:Idem Builders — Privacy Policy`;
  protected effectiveDate = $localize`:@@buildersPrivacy.effective_date:November 5, 2026`;
  protected showVersionSelector = false;
  protected versions: string[] = [];
  protected currentVersion = '';

  protected navigation: LegalNavItem[] = [
    { id: 'scope', title: $localize`:@@buildersPrivacy.scope.title:1. WHAT THIS POLICY COVERS`, titleI18n: '@@buildersPrivacy.scope.title' },
    { id: 'controller', title: $localize`:@@buildersPrivacy.controller.title:2. WHO IS RESPONSIBLE`, titleI18n: '@@buildersPrivacy.controller.title' },
    { id: 'data', title: $localize`:@@buildersPrivacy.data.title:3. DATA WE PROCESS`, titleI18n: '@@buildersPrivacy.data.title' },
    { id: 'purposes', title: $localize`:@@buildersPrivacy.purposes.title:4. WHY, AND ON WHAT BASIS`, titleI18n: '@@buildersPrivacy.purposes.title' },
    { id: 'public', title: $localize`:@@buildersPrivacy.public.title:5. WHAT BECOMES PUBLIC`, titleI18n: '@@buildersPrivacy.public.title' },
    { id: 'recipients', title: $localize`:@@buildersPrivacy.recipients.title:6. WHO CAN SEE YOUR DATA`, titleI18n: '@@buildersPrivacy.recipients.title' },
    { id: 'hosting', title: $localize`:@@buildersPrivacy.hosting.title:7. WHERE YOUR DATA IS STORED`, titleI18n: '@@buildersPrivacy.hosting.title' },
    { id: 'retention', title: $localize`:@@buildersPrivacy.retention.title:8. HOW LONG WE KEEP IT`, titleI18n: '@@buildersPrivacy.retention.title' },
    { id: 'security', title: $localize`:@@buildersPrivacy.security.title:9. SECURITY`, titleI18n: '@@buildersPrivacy.security.title' },
    { id: 'automated', title: $localize`:@@buildersPrivacy.automated.title:10. AUTOMATED CHECKS`, titleI18n: '@@buildersPrivacy.automated.title' },
    { id: 'rights', title: $localize`:@@buildersPrivacy.rights.title:11. YOUR RIGHTS`, titleI18n: '@@buildersPrivacy.rights.title' },
    { id: 'minors', title: $localize`:@@buildersPrivacy.minors.title:12. MINORS`, titleI18n: '@@buildersPrivacy.minors.title' },
    { id: 'changes', title: $localize`:@@buildersPrivacy.changes.title:13. CHANGES TO THIS POLICY`, titleI18n: '@@buildersPrivacy.changes.title' },
    { id: 'contact', title: $localize`:@@buildersPrivacy.contact.title:14. CONTACT`, titleI18n: '@@buildersPrivacy.contact.title' },
  ];

  protected sections: LegalSection[] = [];

  ngOnInit(): void {
    this.sections = [
      {
        id: 'scope',
        title: $localize`:@@buildersPrivacy.scope.title:1. WHAT THIS POLICY COVERS`,
        titleI18n: '@@buildersPrivacy.scope.title',
        content: $localize`:@@buildersPrivacy.scope.content:This policy describes the personal data processed for the Idem Builders programme: your application, its review, the benefits granted and the public showcase. It supplements the IDEM Privacy Policy, which continues to apply to the rest of your use of IDEM.`,
        contentI18n: '@@buildersPrivacy.scope.content',
      },
      {
        id: 'controller',
        title: $localize`:@@buildersPrivacy.controller.title:2. WHO IS RESPONSIBLE`,
        titleI18n: '@@buildersPrivacy.controller.title',
        content: $localize`:@@buildersPrivacy.controller.content:The data controller is IDEM, Douala, Cameroon. For any question about your data: legal@idem.africa.`,
        contentI18n: '@@buildersPrivacy.controller.content',
      },
      {
        id: 'data',
        title: $localize`:@@buildersPrivacy.data.title:3. DATA WE PROCESS`,
        titleI18n: '@@buildersPrivacy.data.title',
        content: $localize`:@@buildersPrivacy.data.content:For the programme, IDEM processes:`,
        contentI18n: '@@buildersPrivacy.data.content',
        list: [
          { text: $localize`:@@buildersPrivacy.data.identity:your IDEM account identifier, email address and display name;`, textI18n: '@@buildersPrivacy.data.identity' },
          { text: $localize`:@@buildersPrivacy.data.project:the project you submit: its name, description, country and public address;`, textI18n: '@@buildersPrivacy.data.project' },
          { text: $localize`:@@buildersPrivacy.data.pitch:the text in which you explain how the project puts Africa forward;`, textI18n: '@@buildersPrivacy.data.pitch' },
          { text: $localize`:@@buildersPrivacy.data.brand:the brand identity of the project created in IDEM (logo, colours, typefaces), read from the project when the page is displayed;`, textI18n: '@@buildersPrivacy.data.brand' },
          { text: $localize`:@@buildersPrivacy.data.team:if you choose to publish it, the team entered in the project: name, role, short biography, photograph and professional links of each member;`, textI18n: '@@buildersPrivacy.data.team' },
          { text: $localize`:@@buildersPrivacy.data.signals:a snapshot, taken on the day you apply, of what the project does with IDEM — only yes or no for each item (online with iDeploy, marketing in IDEM, domain, brand, business plan…), never the content of your documents;`, textI18n: '@@buildersPrivacy.data.signals' },
          { text: $localize`:@@buildersPrivacy.data.consent:the proof that you accepted the terms: version, date and time, IP address and browser identifier;`, textI18n: '@@buildersPrivacy.data.consent' },
          { text: $localize`:@@buildersPrivacy.data.decision:the decision: status, date, team member who decided and, in case of refusal, the reason;`, textI18n: '@@buildersPrivacy.data.decision' },
          { text: $localize`:@@buildersPrivacy.data.benefits:the benefits granted, recorded in your wallet history;`, textI18n: '@@buildersPrivacy.data.benefits' },
          { text: $localize`:@@buildersPrivacy.data.emails:the sending record of the emails about your application (address, date, delivery status).`, textI18n: '@@buildersPrivacy.data.emails' },
        ],
        warning: {
          type: 'info',
          title: $localize`:@@buildersPrivacy.data.not.title:What we do not collect`,
          titleI18n: '@@buildersPrivacy.data.not.title',
          content: $localize`:@@buildersPrivacy.data.not.content:The programme asks for no identity document, no bank or Mobile Money details and no information about your customers.`,
          contentI18n: '@@buildersPrivacy.data.not.content',
        },
      },
      {
        id: 'purposes',
        title: $localize`:@@buildersPrivacy.purposes.title:4. WHY, AND ON WHAT BASIS`,
        titleI18n: '@@buildersPrivacy.purposes.title',
        content: $localize`:@@buildersPrivacy.purposes.content:Each use has its own purpose and legal basis:`,
        contentI18n: '@@buildersPrivacy.purposes.content',
        list: [
          { text: $localize`:@@buildersPrivacy.purposes.review:Reviewing your application and answering it — basis: your request and these terms.`, textI18n: '@@buildersPrivacy.purposes.review' },
          { text: $localize`:@@buildersPrivacy.purposes.benefits:Granting and applying the benefits (bonus, top-up credit, hosting discount) — basis: performance of the programme terms.`, textI18n: '@@buildersPrivacy.purposes.benefits' },
          { text: $localize`:@@buildersPrivacy.purposes.showcase:Publishing the project on the showcase and on its own page, with its team if you chose it — basis: your consent, which you can withdraw at any time.`, textI18n: '@@buildersPrivacy.purposes.showcase' },
          { text: $localize`:@@buildersPrivacy.purposes.emails:Writing to you about your application and the programme — basis: performance of the programme terms.`, textI18n: '@@buildersPrivacy.purposes.emails' },
          { text: $localize`:@@buildersPrivacy.purposes.proof:Keeping the proof of your acceptance and preventing fraud (multiple accounts, fictitious projects) — basis: the legitimate interest of IDEM.`, textI18n: '@@buildersPrivacy.purposes.proof' },
          { text: $localize`:@@buildersPrivacy.purposes.stats:Measuring the programme with aggregated statistics, which identify no one — basis: the legitimate interest of IDEM.`, textI18n: '@@buildersPrivacy.purposes.stats' },
        ],
      },
      {
        id: 'public',
        title: $localize`:@@buildersPrivacy.public.title:5. WHAT BECOMES PUBLIC`,
        titleI18n: '@@buildersPrivacy.public.title',
        content: $localize`:@@buildersPrivacy.public.content:If your project is admitted, its page and the showcase show: its name, description, country and city, public address, date of admission, the text in which you present it, its brand identity (logo, colours, typefaces) and the list of what it does with IDEM (online, marketing, brand, business plan…). The team appears only if you chose it, without email addresses. Your own email address, the reason for a decision and your proof of acceptance are never published. You can ask at any time to hide the project from the showcase, or to remove the team from its page.`,
        contentI18n: '@@buildersPrivacy.public.content',
      },
      {
        id: 'recipients',
        title: $localize`:@@buildersPrivacy.recipients.title:6. WHO CAN SEE YOUR DATA`,
        titleI18n: '@@buildersPrivacy.recipients.title',
        list: [
          { text: $localize`:@@buildersPrivacy.recipients.team:The IDEM team members in charge of the programme, through the administration panel; their access requires authentication and their actions are logged.`, textI18n: '@@buildersPrivacy.recipients.team' },
          { text: $localize`:@@buildersPrivacy.recipients.providers:The technical providers IDEM relies on to host the platform and send emails, bound by confidentiality and acting only on IDEM instructions.`, textI18n: '@@buildersPrivacy.recipients.providers' },
          { text: $localize`:@@buildersPrivacy.recipients.authorities:Public authorities, only when the law requires it.`, textI18n: '@@buildersPrivacy.recipients.authorities' },
        ],
        warning: {
          type: 'info',
          title: $localize`:@@buildersPrivacy.recipients.nosale.title:No sale, no advertising`,
          titleI18n: '@@buildersPrivacy.recipients.nosale.title',
          content: $localize`:@@buildersPrivacy.recipients.nosale.content:Your data is never sold, rented or shared for advertising purposes.`,
          contentI18n: '@@buildersPrivacy.recipients.nosale.content',
        },
      },
      {
        id: 'hosting',
        title: $localize`:@@buildersPrivacy.hosting.title:7. WHERE YOUR DATA IS STORED`,
        titleI18n: '@@buildersPrivacy.hosting.title',
        content: $localize`:@@buildersPrivacy.hosting.content:Programme data is stored in the IDEM platform database, on the servers IDEM uses for the whole platform. When a provider processes data outside your country, IDEM requires contractual guarantees of a level of protection equivalent to this policy.`,
        contentI18n: '@@buildersPrivacy.hosting.content',
      },
      {
        id: 'retention',
        title: $localize`:@@buildersPrivacy.retention.title:8. HOW LONG WE KEEP IT`,
        titleI18n: '@@buildersPrivacy.retention.title',
        list: [
          { text: $localize`:@@buildersPrivacy.retention.refused:Application not admitted: 12 months after the decision, then deleted.`, textI18n: '@@buildersPrivacy.retention.refused' },
          { text: $localize`:@@buildersPrivacy.retention.member:Admitted application: for the whole membership, then 3 years after you leave the programme.`, textI18n: '@@buildersPrivacy.retention.member' },
          { text: $localize`:@@buildersPrivacy.retention.proof:Proof of acceptance of the terms: 5 years after the end of your participation, to answer a possible dispute.`, textI18n: '@@buildersPrivacy.retention.proof' },
          { text: $localize`:@@buildersPrivacy.retention.ledger:Wallet entries for the credits granted: for the period required by accounting rules (10 years under OHADA accounting law).`, textI18n: '@@buildersPrivacy.retention.ledger' },
          { text: $localize`:@@buildersPrivacy.retention.emails:Email sending records: 12 months.`, textI18n: '@@buildersPrivacy.retention.emails' },
        ],
      },
      {
        id: 'security',
        title: $localize`:@@buildersPrivacy.security.title:9. SECURITY`,
        titleI18n: '@@buildersPrivacy.security.title',
        content: $localize`:@@buildersPrivacy.security.content:Data travels encrypted (HTTPS). Access to the administration panel is restricted to authenticated team members, and each decision records who made it. The programme collects only what the review needs.`,
        contentI18n: '@@buildersPrivacy.security.content',
      },
      {
        id: 'automated',
        title: $localize`:@@buildersPrivacy.automated.title:10. AUTOMATED CHECKS`,
        titleI18n: '@@buildersPrivacy.automated.title',
        content: $localize`:@@buildersPrivacy.automated.content:Before you apply, IDEM automatically checks whether the project is run with IDEM. This check only opens or closes the application form; it never decides on admission. Every decision is taken by a person.`,
        contentI18n: '@@buildersPrivacy.automated.content',
      },
      {
        id: 'rights',
        title: $localize`:@@buildersPrivacy.rights.title:11. YOUR RIGHTS`,
        titleI18n: '@@buildersPrivacy.rights.title',
        content: $localize`:@@buildersPrivacy.rights.content:Under the applicable law, including Cameroon law no. 2024/017 of 23 December 2024 on the protection of personal data, you have the right to:`,
        contentI18n: '@@buildersPrivacy.rights.content',
        list: [
          { text: $localize`:@@buildersPrivacy.rights.access:access your data and obtain a copy of it;`, textI18n: '@@buildersPrivacy.rights.access' },
          { text: $localize`:@@buildersPrivacy.rights.rectify:have it corrected or completed;`, textI18n: '@@buildersPrivacy.rights.rectify' },
          { text: $localize`:@@buildersPrivacy.rights.erase:have it deleted, within the limits of the retention periods in section 8;`, textI18n: '@@buildersPrivacy.rights.erase' },
          { text: $localize`:@@buildersPrivacy.rights.object:object to a processing based on legitimate interest, or ask for it to be limited;`, textI18n: '@@buildersPrivacy.rights.object' },
          { text: $localize`:@@buildersPrivacy.rights.withdraw:withdraw your consent to the showcase, or leave the programme, at any time;`, textI18n: '@@buildersPrivacy.rights.withdraw' },
          { text: $localize`:@@buildersPrivacy.rights.portability:receive the data you provided in a common, readable format.`, textI18n: '@@buildersPrivacy.rights.portability' },
        ],
        subsections: [
          {
            title: $localize`:@@buildersPrivacy.rights.how.title:How to exercise them`,
            titleI18n: '@@buildersPrivacy.rights.how.title',
            content: $localize`:@@buildersPrivacy.rights.how.content:Write to legal@idem.africa from the address of your IDEM account. IDEM answers within 30 days and may ask you to prove your identity. If you are not satisfied with the answer, you can lodge a complaint with the personal data protection authority of your country.`,
            contentI18n: '@@buildersPrivacy.rights.how.content',
          },
        ],
      },
      {
        id: 'minors',
        title: $localize`:@@buildersPrivacy.minors.title:12. MINORS`,
        titleI18n: '@@buildersPrivacy.minors.title',
        content: $localize`:@@buildersPrivacy.minors.content:The programme is open to adults only. IDEM deletes any application found to come from a minor.`,
        contentI18n: '@@buildersPrivacy.minors.content',
      },
      {
        id: 'changes',
        title: $localize`:@@buildersPrivacy.changes.title:13. CHANGES TO THIS POLICY`,
        titleI18n: '@@buildersPrivacy.changes.title',
        content: $localize`:@@buildersPrivacy.changes.content:IDEM may update this policy. Substantial changes are announced by email and in the console before they apply. The version you accepted is recorded with your application.`,
        contentI18n: '@@buildersPrivacy.changes.content',
      },
      {
        id: 'contact',
        title: $localize`:@@buildersPrivacy.contact.title:14. CONTACT`,
        titleI18n: '@@buildersPrivacy.contact.title',
        content: $localize`:@@buildersPrivacy.contact.content:Personal data: legal@idem.africa. Programme: contact@idem.africa. IDEM, Douala, Cameroon.`,
        contentI18n: '@@buildersPrivacy.contact.content',
      },
    ];
  }
}
