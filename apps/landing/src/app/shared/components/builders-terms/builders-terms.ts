import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LegalDocumentTemplate,
  LegalNavItem,
  LegalSection,
} from '../legal-document-template/legal-document-template';

/**
 * Conditions de participation au programme Idem Builders.
 *
 * Acceptées par une case à cocher avant chaque candidature (console) ;
 * l'API refuse un dépôt sans elles et enregistre la version acceptée
 * (`BUILDERS_LEGAL_VERSION` dans `@idem/shared-models`), la date, l'adresse
 * IP et le navigateur. Changer le fond de ce texte oblige à changer cette
 * version.
 *
 * Généré depuis une source unique fr/en : modifier les deux langues ensemble.
 */
@Component({
  selector: 'app-builders-terms',
  standalone: true,
  imports: [CommonModule, LegalDocumentTemplate],
  templateUrl: './builders-terms.html',
})
export class BuildersTerms implements OnInit {
  protected title = 'IDEM Legal';
  protected subtitle = $localize`:@@buildersTerms.subtitle:Idem Builders — Programme Participation Terms`;
  protected effectiveDate = $localize`:@@buildersTerms.effective_date:November 5, 2026`;
  protected showVersionSelector = false;
  protected versions: string[] = [];
  protected currentVersion = '';

  protected navigation: LegalNavItem[] = [
    { id: 'purpose', title: $localize`:@@buildersTerms.purpose.title:1. PURPOSE AND ACCEPTANCE`, titleI18n: '@@buildersTerms.purpose.title' },
    { id: 'programme', title: $localize`:@@buildersTerms.programme.title:2. WHAT THE PROGRAMME IS`, titleI18n: '@@buildersTerms.programme.title' },
    { id: 'eligibility', title: $localize`:@@buildersTerms.eligibility.title:3. WHO CAN APPLY`, titleI18n: '@@buildersTerms.eligibility.title' },
    { id: 'application', title: $localize`:@@buildersTerms.application.title:4. YOUR APPLICATION`, titleI18n: '@@buildersTerms.application.title' },
    { id: 'review', title: $localize`:@@buildersTerms.review.title:5. REVIEW AND DECISION`, titleI18n: '@@buildersTerms.review.title' },
    { id: 'benefits', title: $localize`:@@buildersTerms.benefits.title:6. BENEFITS`, titleI18n: '@@buildersTerms.benefits.title' },
    { id: 'showcase', title: $localize`:@@buildersTerms.showcase.title:7. SHOWCASE, BADGE AND LICENCE`, titleI18n: '@@buildersTerms.showcase.title' },
    { id: 'commitments', title: $localize`:@@buildersTerms.commitments.title:8. YOUR COMMITMENTS`, titleI18n: '@@buildersTerms.commitments.title' },
    { id: 'exit', title: $localize`:@@buildersTerms.exit.title:9. DURATION, LEAVING AND EXCLUSION`, titleI18n: '@@buildersTerms.exit.title' },
    { id: 'ip', title: $localize`:@@buildersTerms.ip.title:10. INTELLECTUAL PROPERTY`, titleI18n: '@@buildersTerms.ip.title' },
    { id: 'liability', title: $localize`:@@buildersTerms.liability.title:11. LIABILITY`, titleI18n: '@@buildersTerms.liability.title' },
    { id: 'changes', title: $localize`:@@buildersTerms.changes.title:12. CHANGES AND END OF THE PROGRAMME`, titleI18n: '@@buildersTerms.changes.title' },
    { id: 'law', title: $localize`:@@buildersTerms.law.title:13. GOVERNING LAW AND DISPUTES`, titleI18n: '@@buildersTerms.law.title' },
    { id: 'contact', title: $localize`:@@buildersTerms.contact.title:14. CONTACT`, titleI18n: '@@buildersTerms.contact.title' },
  ];

  protected sections: LegalSection[] = [];

  ngOnInit(): void {
    this.sections = [
      {
        id: 'purpose',
        title: $localize`:@@buildersTerms.purpose.title:1. PURPOSE AND ACCEPTANCE`,
        titleI18n: '@@buildersTerms.purpose.title',
        content: $localize`:@@buildersTerms.purpose.content:These terms govern participation in Idem Builders, the programme run by IDEM (Douala, Cameroon) that showcases projects which put Africa forward and are run with IDEM. They come in addition to the IDEM Terms of Service and Privacy Policy, and to the Idem Builders Privacy Policy, which all continue to apply. Where a point is specific to the programme, these terms prevail. You accept them by ticking the box provided for that purpose before sending your application. IDEM records the version accepted, the date and time, your IP address and your browser identifier, as proof of that acceptance.`,
        contentI18n: '@@buildersTerms.purpose.content',
      },
      {
        id: 'programme',
        title: $localize`:@@buildersTerms.programme.title:2. WHAT THE PROGRAMME IS`,
        titleI18n: '@@buildersTerms.programme.title',
        content: $localize`:@@buildersTerms.programme.content:Idem Builders is free. Applying does not oblige you to buy anything, and being admitted does not create any partnership, employment, sponsorship, investment, agency or exclusivity between you and IDEM. Admission is a recognition of your project and gives access to the benefits described in section 6, for as long as you remain a member.`,
        contentI18n: '@@buildersTerms.programme.content',
      },
      {
        id: 'eligibility',
        title: $localize`:@@buildersTerms.eligibility.title:3. WHO CAN APPLY`,
        titleI18n: '@@buildersTerms.eligibility.title',
        content: $localize`:@@buildersTerms.eligibility.content:To apply, all of the following conditions must be met:`,
        contentI18n: '@@buildersTerms.eligibility.content',
        list: [
          { text: $localize`:@@buildersTerms.eligibility.account:You have an IDEM account in your own name and you are of legal age (18 or older).`, textI18n: '@@buildersTerms.eligibility.account' },
          { text: $localize`:@@buildersTerms.eligibility.owner:You own the project you submit, or you are authorised to represent it.`, textI18n: '@@buildersTerms.eligibility.owner' },
          { text: $localize`:@@buildersTerms.eligibility.managed:The project is run with IDEM: it is online through iDeploy, or its marketing is managed in IDEM, or its domain name was registered through IDEM. IDEM checks this automatically before you can apply.`, textI18n: '@@buildersTerms.eligibility.managed' },
          { text: $localize`:@@buildersTerms.eligibility.africa:The project puts Africa forward: it serves African users, solves a problem faced in Africa, or is built and led from Africa.`, textI18n: '@@buildersTerms.eligibility.africa' },
          { text: $localize`:@@buildersTerms.eligibility.real:The project is real, active and lawful in the countries where it operates.`, textI18n: '@@buildersTerms.eligibility.real' },
        ],
        subsections: [
          {
            title: $localize`:@@buildersTerms.eligibility.excluded.title:Projects that cannot be admitted`,
            titleI18n: '@@buildersTerms.eligibility.excluded.title',
            content: $localize`:@@buildersTerms.eligibility.excluded.content:Whatever their quality, the following are excluded:`,
            contentI18n: '@@buildersTerms.eligibility.excluded.content',
            list: [
              { text: $localize`:@@buildersTerms.eligibility.excluded.illegal:Activities that are illegal, or that require a licence the project does not hold (gambling, financial services, health products…).`, textI18n: '@@buildersTerms.eligibility.excluded.illegal' },
              { text: $localize`:@@buildersTerms.eligibility.excluded.harm:Content that is hateful, violent, sexually explicit, discriminatory or that exploits minors.`, textI18n: '@@buildersTerms.eligibility.excluded.harm' },
              { text: $localize`:@@buildersTerms.eligibility.excluded.deceptive:Deceptive schemes: pyramid or Ponzi schemes, guaranteed returns, counterfeits, fake reviews.`, textI18n: '@@buildersTerms.eligibility.excluded.deceptive' },
              { text: $localize`:@@buildersTerms.eligibility.excluded.political:Electoral campaigns and political parties.`, textI18n: '@@buildersTerms.eligibility.excluded.political' },
              { text: $localize`:@@buildersTerms.eligibility.excluded.rights:Projects that infringe a third party's rights (trademarks, copyright, image rights).`, textI18n: '@@buildersTerms.eligibility.excluded.rights' },
            ],
          },
        ],
      },
      {
        id: 'application',
        title: $localize`:@@buildersTerms.application.title:4. YOUR APPLICATION`,
        titleI18n: '@@buildersTerms.application.title',
        content: $localize`:@@buildersTerms.application.content:An application is made from the IDEM console, project by project.`,
        contentI18n: '@@buildersTerms.application.content',
        list: [
          { text: $localize`:@@buildersTerms.application.accurate:The information you give must be accurate and must stay up to date. An application based on false information may be refused or withdrawn at any time.`, textI18n: '@@buildersTerms.application.accurate' },
          { text: $localize`:@@buildersTerms.application.one:Only one application can be open or accepted at a time for the same project.`, textI18n: '@@buildersTerms.application.one' },
          { text: $localize`:@@buildersTerms.application.more:The team may contact you by email to ask for details before deciding.`, textI18n: '@@buildersTerms.application.more' },
        ],
      },
      {
        id: 'review',
        title: $localize`:@@buildersTerms.review.title:5. REVIEW AND DECISION`,
        titleI18n: '@@buildersTerms.review.title',
        content: $localize`:@@buildersTerms.review.content:Every application is read and decided by a member of the IDEM team. The automatic check described in section 3 only decides whether you can apply; it never accepts or refuses an application on its own. The team considers how real and active the project is, how it uses IDEM, what it brings to Africa, and its compliance with these terms. IDEM aims to answer within five working days, without guaranteeing it. The decision is sent by email and shown in your console. A refusal comes with a reason; you may apply again once the project has changed. Admission is at the discretion of IDEM and is not a right.`,
        contentI18n: '@@buildersTerms.review.content',
      },
      {
        id: 'benefits',
        title: $localize`:@@buildersTerms.benefits.title:6. BENEFITS`,
        titleI18n: '@@buildersTerms.benefits.title',
        content: $localize`:@@buildersTerms.benefits.content:Admission gives access to the following benefits, as published on the programme page on the day of admission:`,
        contentI18n: '@@buildersTerms.benefits.content',
        list: [
          { text: $localize`:@@buildersTerms.benefits.welcome:A welcome bonus credited to your IDEM wallet when your first project is admitted — once per account, whatever the number of projects admitted.`, textI18n: '@@buildersTerms.benefits.welcome' },
          { text: $localize`:@@buildersTerms.benefits.topup:An extra credit on each wallet top-up made while you are a member, added to the tier bonus. It does not apply to top-ups made before admission.`, textI18n: '@@buildersTerms.benefits.topup' },
          { text: $localize`:@@buildersTerms.benefits.hosting:A discount on the daily price of the iDeploy hosting tiers paid from your wallet. Options are charged at full price; days covered by a plan or by prepaid days are not affected.`, textI18n: '@@buildersTerms.benefits.hosting' },
          { text: $localize`:@@buildersTerms.benefits.showcase:A presentation of the project on idem.africa/builders, unless you ask to hide it.`, textI18n: '@@buildersTerms.benefits.showcase' },
          { text: $localize`:@@buildersTerms.benefits.portrait:Possibly, a feature on the IDEM blog, social networks or newsletters, chosen by the team and prepared with you.`, textI18n: '@@buildersTerms.benefits.portrait' },
          { text: $localize`:@@buildersTerms.benefits.badge:The right to display the Idem Builder badge, under section 7.`, textI18n: '@@buildersTerms.benefits.badge' },
        ],
        warning: {
          type: 'info',
          title: $localize`:@@buildersTerms.benefits.rules.title:Rules that apply to every credit`,
          titleI18n: '@@buildersTerms.benefits.rules.title',
          content: $localize`:@@buildersTerms.benefits.rules.content:Credits granted by the programme are spent on IDEM services only. They cannot be converted into cash, transferred to another account or refunded. IDEM may change the benefits for the future with 30 days notice; credits already granted remain yours, except in case of fraud (section 9).`,
          contentI18n: '@@buildersTerms.benefits.rules.content',
        },
      },
      {
        id: 'showcase',
        title: $localize`:@@buildersTerms.showcase.title:7. SHOWCASE, BADGE AND LICENCE`,
        titleI18n: '@@buildersTerms.showcase.title',
        content: $localize`:@@buildersTerms.showcase.content:To present your project, you grant IDEM a non-exclusive, free and worldwide licence to reproduce and show, on idem.africa, the IDEM blog, social networks, newsletters and presentations about the programme: its name, its description, its country and city, its public address, the text in which you present it, and its brand identity as created in IDEM (logo, colours, typefaces). The project page composes a cover from that identity. This licence lasts for your membership; content already published (blog posts, past newsletters) may stay online as an archive. Any other element (screenshots, quotes, photographs) is only used with your explicit agreement, given for each feature.`,
        contentI18n: '@@buildersTerms.showcase.content',
        subsections: [
          {
            title: $localize`:@@buildersTerms.showcase.team.title:Your team on the project page`,
            titleI18n: '@@buildersTerms.showcase.team.title',
            content: $localize`:@@buildersTerms.showcase.team.content:The members of the team, as entered in the IDEM project (name, role, short biography, photograph, professional links), appear on the project page only if you choose it when you apply. By making that choice, you confirm that each person shown has agreed to it. You can withdraw that choice at any time by writing to us; the team then disappears from the page. Email addresses are never published.`,
            contentI18n: '@@buildersTerms.showcase.team.content',
          },
          {
            title: $localize`:@@buildersTerms.showcase.badge.title:The Idem Builder badge`,
            titleI18n: '@@buildersTerms.showcase.badge.title',
            content: $localize`:@@buildersTerms.showcase.badge.content:While you are a member, IDEM grants you a personal, free and revocable right to display the badge on the channels of the admitted project, without altering it. The badge says that the project belongs to the programme; it is not a certification, a guarantee or an endorsement of your products by IDEM, and must not be presented as such. You remove it within 15 days of leaving the programme.`,
            contentI18n: '@@buildersTerms.showcase.badge.content',
          },
        ],
      },
      {
        id: 'commitments',
        title: $localize`:@@buildersTerms.commitments.title:8. YOUR COMMITMENTS`,
        titleI18n: '@@buildersTerms.commitments.title',
        content: $localize`:@@buildersTerms.commitments.content:As a member, you undertake to:`,
        contentI18n: '@@buildersTerms.commitments.content',
        list: [
          { text: $localize`:@@buildersTerms.commitments.lawful:keep the project lawful and compliant with the IDEM Terms of Service;`, textI18n: '@@buildersTerms.commitments.lawful' },
          { text: $localize`:@@buildersTerms.commitments.inform:tell IDEM about any major change: change of activity, closure, transfer of the project;`, textI18n: '@@buildersTerms.commitments.inform' },
          { text: $localize`:@@buildersTerms.commitments.fair:not obtain benefits unfairly: several accounts for the same person, fictitious projects, top-ups made on behalf of third parties;`, textI18n: '@@buildersTerms.commitments.fair' },
          { text: $localize`:@@buildersTerms.commitments.badge:use the IDEM name and badge only as these terms allow.`, textI18n: '@@buildersTerms.commitments.badge' },
        ],
      },
      {
        id: 'exit',
        title: $localize`:@@buildersTerms.exit.title:9. DURATION, LEAVING AND EXCLUSION`,
        titleI18n: '@@buildersTerms.exit.title',
        content: $localize`:@@buildersTerms.exit.content:Membership has no fixed term. You can leave the programme at any time by writing to contact@idem.africa; the benefits then stop for the future. IDEM may suspend or end a membership if the project no longer meets the conditions of section 3, or in case of breach of these terms. Except for a serious breach, IDEM first tells you by email and gives you 15 days to put things right. In case of fraud, IDEM may also cancel credits granted by the programme that have not yet been spent.`,
        contentI18n: '@@buildersTerms.exit.content',
      },
      {
        id: 'ip',
        title: $localize`:@@buildersTerms.ip.title:10. INTELLECTUAL PROPERTY`,
        titleI18n: '@@buildersTerms.ip.title',
        content: $localize`:@@buildersTerms.ip.content:You keep all rights to your project, its name, its brand and its content; the only right granted to IDEM is the licence in section 7. IDEM keeps all rights to its name, its brands, the name Idem Builders and the badge.`,
        contentI18n: '@@buildersTerms.ip.content',
      },
      {
        id: 'liability',
        title: $localize`:@@buildersTerms.liability.title:11. LIABILITY`,
        titleI18n: '@@buildersTerms.liability.title',
        content: $localize`:@@buildersTerms.liability.content:The programme is offered as it is. IDEM does not promise any level of visibility, traffic, sales, revenue or funding. IDEM is not liable for indirect losses, nor for the content of your site or application, even when the showcase links to it. You remain solely responsible for your project, its content and its relations with your own customers. Nothing in these terms limits liability that the law does not allow to be limited.`,
        contentI18n: '@@buildersTerms.liability.content',
      },
      {
        id: 'changes',
        title: $localize`:@@buildersTerms.changes.title:12. CHANGES AND END OF THE PROGRAMME`,
        titleI18n: '@@buildersTerms.changes.title',
        content: $localize`:@@buildersTerms.changes.content:IDEM may change these terms. Any substantial change is announced by email and in the console at least 30 days before it applies, with its new version number; remaining a member after that date means accepting it, and you may leave before. IDEM may also end the programme with 30 days notice. Credits already granted remain usable under the rules of the IDEM wallet.`,
        contentI18n: '@@buildersTerms.changes.content',
      },
      {
        id: 'law',
        title: $localize`:@@buildersTerms.law.title:13. GOVERNING LAW AND DISPUTES`,
        titleI18n: '@@buildersTerms.law.title',
        content: $localize`:@@buildersTerms.law.content:These terms are governed by the law of Cameroon, including the Uniform Acts of OHADA where they apply. In case of disagreement, write to us first: we look for an amicable solution within 30 days. Failing that, the competent courts of Douala have jurisdiction, subject to the mandatory rules that protect consumers in their country of residence.`,
        contentI18n: '@@buildersTerms.law.content',
      },
      {
        id: 'contact',
        title: $localize`:@@buildersTerms.contact.title:14. CONTACT`,
        titleI18n: '@@buildersTerms.contact.title',
        content: $localize`:@@buildersTerms.contact.content:Questions about the programme: contact@idem.africa. Legal questions: legal@idem.africa. IDEM, Douala, Cameroon.`,
        contentI18n: '@@buildersTerms.contact.content',
      },
    ];
  }
}
