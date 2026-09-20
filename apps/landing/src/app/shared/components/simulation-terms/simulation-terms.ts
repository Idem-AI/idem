import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LegalDocumentTemplate,
  LegalNavItem,
  LegalSection,
} from '../legal-document-template/legal-document-template';

/**
 * Conditions d'utilisation propres à IDEM Simulation.
 *
 * Les conditions générales couvrent la plateforme ; elles ne disent rien de ce
 * qu'un indice de viabilité veut dire, ni de ce qu'il advient d'un business
 * plan téléversé. Or c'est précisément ce que l'utilisateur accepte avant de
 * lancer une exécution, et ce que cette page décrit : la nature du résultat,
 * la limite de sa portée, et le trajet du document.
 */
@Component({
  selector: 'app-simulation-terms',
  standalone: true,
  imports: [CommonModule, LegalDocumentTemplate],
  templateUrl: './simulation-terms.html',
  styleUrl: './simulation-terms.css',
})
export class SimulationTerms implements OnInit {
  protected title = 'IDEM Legal';
  protected subtitle = $localize`:@@simTerms.subtitle:Terms of Use for IDEM Simulation — business viability simulation`;
  protected effectiveDate = $localize`:@@simTerms.effective_date:September 1, 2026`;
  protected showVersionSelector = false;
  protected versions: string[] = [];
  protected currentVersion = '';

  protected navigation: LegalNavItem[] = [
    { id: 'scope', title: $localize`:@@simTerms.nav.scope:1. WHAT THESE TERMS COVER`, titleI18n: '@@simTerms.nav.scope' },
    { id: 'what-it-is', title: $localize`:@@simTerms.nav.what_it_is:2. WHAT A SIMULATION IS`, titleI18n: '@@simTerms.nav.what_it_is' },
    { id: 'not-a-prediction', title: $localize`:@@simTerms.nav.not_a_prediction:3. WHAT A SIMULATION IS NOT`, titleI18n: '@@simTerms.nav.not_a_prediction' },
    { id: 'no-advice', title: $localize`:@@simTerms.nav.no_advice:4. NOT PROFESSIONAL ADVICE`, titleI18n: '@@simTerms.nav.no_advice' },
    { id: 'your-document', title: $localize`:@@simTerms.nav.your_document:5. YOUR BUSINESS PLAN`, titleI18n: '@@simTerms.nav.your_document' },
    { id: 'ai-processing', title: $localize`:@@simTerms.nav.ai_processing:6. PROCESSING BY AI MODELS`, titleI18n: '@@simTerms.nav.ai_processing' },
    { id: 'project-creation', title: $localize`:@@simTerms.nav.project_creation:7. THE PROJECT CREATED FROM YOUR PLAN`, titleI18n: '@@simTerms.nav.project_creation' },
    { id: 'your-responsibilities', title: $localize`:@@simTerms.nav.your_responsibilities:8. YOUR RESPONSIBILITIES`, titleI18n: '@@simTerms.nav.your_responsibilities' },
    { id: 'billing', title: $localize`:@@simTerms.nav.billing:9. PRICE AND BILLING`, titleI18n: '@@simTerms.nav.billing' },
    { id: 'availability', title: $localize`:@@simTerms.nav.availability:10. AVAILABILITY AND FAILED RUNS`, titleI18n: '@@simTerms.nav.availability' },
    { id: 'ownership', title: $localize`:@@simTerms.nav.ownership:11. OWNERSHIP OF THE RESULTS`, titleI18n: '@@simTerms.nav.ownership' },
    { id: 'liability', title: $localize`:@@simTerms.nav.liability:12. LIABILITY`, titleI18n: '@@simTerms.nav.liability' },
    { id: 'changes', title: $localize`:@@simTerms.nav.changes:13. CHANGES TO THESE TERMS`, titleI18n: '@@simTerms.nav.changes' },
    { id: 'contact', title: $localize`:@@simTerms.nav.contact:14. CONTACT`, titleI18n: '@@simTerms.nav.contact' },
  ];

  protected sections: LegalSection[] = [];

  ngOnInit(): void {
    this.sections = [
      {
        id: 'scope',
        title: $localize`:@@simTerms.scope.title:1. WHAT THESE TERMS COVER`,
        titleI18n: '@@simTerms.scope.title',
        content: $localize`:@@simTerms.scope.content:These terms apply to IDEM Simulation, the part of IDEM that puts a business project under stress and returns a viability index, scenarios, factors and a report. They come in addition to the IDEM Terms of Service and to the Privacy Policy, which continue to apply. Where a point is specific to simulation, this document prevails. You are asked to accept these terms before each run, because each run reads your project and sends an extract of it to artificial intelligence models.`,
        contentI18n: '@@simTerms.scope.content',
      },
      {
        id: 'what-it-is',
        title: $localize`:@@simTerms.what_it_is.title:2. WHAT A SIMULATION IS`,
        titleI18n: '@@simTerms.what_it_is.title',
        content: $localize`:@@simTerms.what_it_is.content:A run proceeds in six stages: reading your project or your business plan, discovering the factors that could move it, gathering the external figures it can, building a numeric model, running scenarios on that model, and analysing what came out. The arithmetic is deterministic — the same figures always produce the same projection. What surrounds it is not: the choice of factors, the design of the scenarios and every written commentary are produced by AI models, which can be wrong.`,
        contentI18n: '@@simTerms.what_it_is.content',
        list: [
          { text: $localize`:@@simTerms.what_it_is.baseline:The whole model rests on around ten figures — price, variable cost, fixed costs, acquisition cost, growth, retention, starting capital. Where your project does not state one, the engine estimates it and says so.`, textI18n: '@@simTerms.what_it_is.baseline' },
          { text: $localize`:@@simTerms.what_it_is.states:Every element is presented with its status: read in your source, to be researched, estimated, or missing. That distinction is part of the result and must not be dropped when the result is passed on.`, textI18n: '@@simTerms.what_it_is.states' },
          { text: $localize`:@@simTerms.what_it_is.confidence:Every run carries a confidence level. A high viability index resting on assumptions is not the same claim as the same index resting on established data.`, textI18n: '@@simTerms.what_it_is.confidence' },
        ],
      },
      {
        id: 'not-a-prediction',
        title: $localize`:@@simTerms.not_a_prediction.title:3. WHAT A SIMULATION IS NOT`,
        titleI18n: '@@simTerms.not_a_prediction.title',
        content: $localize`:@@simTerms.not_a_prediction.content:A simulation is a decision-support tool. It describes what happens to a model under the scenarios studied. It does not tell you whether your business will succeed or fail, and no figure it produces should be read as a forecast of your actual revenue, profitability or funding.`,
        contentI18n: '@@simTerms.not_a_prediction.content',
        warning: {
          type: 'warning',
          icon: '⚠️',
          title: $localize`:@@simTerms.not_a_prediction.warning.title:A viability index is not a promise`,
          titleI18n: '@@simTerms.not_a_prediction.warning.title',
          content: $localize`:@@simTerms.not_a_prediction.warning.content:The index measures how robust a model is across the scenarios that were run, on the figures that were available. It is not a probability of success, not a valuation, and not a guarantee of any outcome. Decisions you take on the strength of a run — investing, hiring, borrowing, launching or abandoning — remain entirely yours.`,
          contentI18n: '@@simTerms.not_a_prediction.warning.content',
        },
      },
      {
        id: 'no-advice',
        title: $localize`:@@simTerms.no_advice.title:4. NOT PROFESSIONAL ADVICE`,
        titleI18n: '@@simTerms.no_advice.title',
        content: $localize`:@@simTerms.no_advice.content:Nothing produced by IDEM Simulation — index, scenarios, factors, risks, recommendations, report — constitutes financial, investment, accounting, tax, legal or regulatory advice. IDEM is not a financial adviser, an auditor, an accountant or a law firm, and no client relationship of that kind arises from your use of the service. Before acting on a run, and in particular before presenting one to a bank, an investor or an administration, have it reviewed by a qualified professional in your jurisdiction.`,
        contentI18n: '@@simTerms.no_advice.content',
      },
      {
        id: 'your-document',
        title: $localize`:@@simTerms.your_document.title:5. YOUR BUSINESS PLAN`,
        titleI18n: '@@simTerms.your_document.title',
        content: $localize`:@@simTerms.your_document.content:You may import a business plan in PDF, Word (.docx) or Markdown. Here is what happens to it, stated plainly so that you know what you are agreeing to:`,
        contentI18n: '@@simTerms.your_document.content',
        list: [
          { text: $localize`:@@simTerms.your_document.extraction:The text is extracted from your file. The file itself is not kept after the reading; a scanned document that yields no text is refused.`, textI18n: '@@simTerms.your_document.extraction' },
          { text: $localize`:@@simTerms.your_document.screening:The text is screened without any AI call. A document that has nothing of a business plan is refused at that point, and nothing of it is sent anywhere.`, textI18n: '@@simTerms.your_document.screening' },
          { text: $localize`:@@simTerms.your_document.condensation:Only an extract of the informative passages — on the order of fourteen thousand characters — is sent to the models. Your document is not transmitted in full.`, textI18n: '@@simTerms.your_document.condensation' },
          { text: $localize`:@@simTerms.your_document.cache:The reading produced from that extract is cached for up to seven days, keyed on a fingerprint of the document, so that re-importing the same file costs nothing. It is attached to your account and to no one else's.`, textI18n: '@@simTerms.your_document.cache' },
          { text: $localize`:@@simTerms.your_document.retention:What is kept afterwards is the reading — the profile, the figures, the knowledge items — inside the project it created, under your account, for as long as you keep that project.`, textI18n: '@@simTerms.your_document.retention' },
        ],
      },
      {
        id: 'ai-processing',
        title: $localize`:@@simTerms.ai_processing.title:6. PROCESSING BY AI MODELS`,
        titleI18n: '@@simTerms.ai_processing.title',
        content: $localize`:@@simTerms.ai_processing.content:Running a simulation sends an extract of your project or of your business plan to third-party artificial intelligence providers acting as processors for IDEM. The categories of provider and the safeguards that apply are described in the Privacy Policy, which you also accept before each run. If your plan contains information you are not willing to have processed in that way — personal data of third parties, trade secrets belonging to someone else, information covered by a confidentiality undertaking — remove it before importing.`,
        contentI18n: '@@simTerms.ai_processing.content',
      },
      {
        id: 'project-creation',
        title: $localize`:@@simTerms.project_creation.title:7. THE PROJECT CREATED FROM YOUR PLAN`,
        titleI18n: '@@simTerms.project_creation.title',
        content: $localize`:@@simTerms.project_creation.content:An imported business plan belongs to no existing project, so launching a run creates one in IDEM on your behalf, populated from what the reading yielded: name, description, sector, targets, constraints, budget, and the contact and team details written in your document. That project is yours. It appears in your workspace like any other, it can be edited, and deleting it removes what the reading had stored.`,
        contentI18n: '@@simTerms.project_creation.content',
      },
      {
        id: 'your-responsibilities',
        title: $localize`:@@simTerms.your_responsibilities.title:8. YOUR RESPONSIBILITIES`,
        titleI18n: '@@simTerms.your_responsibilities.title',
        content: $localize`:@@simTerms.your_responsibilities.content:By launching a run you confirm that:`,
        contentI18n: '@@simTerms.your_responsibilities.content',
        list: [
          { text: $localize`:@@simTerms.your_responsibilities.rights:You hold the rights to the document you import, or the authorisation to submit it for processing.`, textI18n: '@@simTerms.your_responsibilities.rights' },
          { text: $localize`:@@simTerms.your_responsibilities.third_party:You have removed, or are entitled to submit, any personal data of third parties it contains.`, textI18n: '@@simTerms.your_responsibilities.third_party' },
          { text: $localize`:@@simTerms.your_responsibilities.accuracy:The figures you supply, including the answers you give to fill the gaps the engine reports, are yours. A run built on wrong inputs produces a wrong result, and the engine cannot detect that.`, textI18n: '@@simTerms.your_responsibilities.accuracy' },
          { text: $localize`:@@simTerms.your_responsibilities.presentation:If you pass a result on to a third party, you keep with it the confidence level and the uncertainties attached to it.`, textI18n: '@@simTerms.your_responsibilities.presentation' },
        ],
      },
      {
        id: 'billing',
        title: $localize`:@@simTerms.billing.title:9. PRICE AND BILLING`,
        titleI18n: '@@simTerms.billing.title',
        content: $localize`:@@simTerms.billing.content:Simulation is billed separately from the rest of IDEM, because a run spends external research, several agents and computation. The price of the level you choose is shown and confirmed before anything starts, and nothing is charged before that confirmation. During the beta, runs are free: prices are displayed struck through and will apply once the beta ends.`,
        contentI18n: '@@simTerms.billing.content',
      },
      {
        id: 'availability',
        title: $localize`:@@simTerms.availability.title:10. AVAILABILITY AND FAILED RUNS`,
        titleI18n: '@@simTerms.availability.title',
        content: $localize`:@@simTerms.availability.content:A run takes several minutes and continues if you close the page. The service depends on third-party AI providers and may be slowed or interrupted by them. No amount is retained for a run that does not complete: a failed run is reported as such and can be relaunched. IDEM gives no undertaking as to the duration of a run, nor as to permanent availability of the service.`,
        contentI18n: '@@simTerms.availability.content',
      },
      {
        id: 'ownership',
        title: $localize`:@@simTerms.ownership.title:11. OWNERSHIP OF THE RESULTS`,
        titleI18n: '@@simTerms.ownership.title',
        content: $localize`:@@simTerms.ownership.content:You keep every right you hold over the business plan you import and over your project. The results of a run — index, scenarios, factors, report — are yours to use, including commercially, subject to the reservations in section 3 and 4. IDEM keeps its rights over the engine, the prompts, the templates and the methodology that produced them. IDEM may use anonymised, aggregated statistics about runs to improve the service, in the conditions set out in the Privacy Policy.`,
        contentI18n: '@@simTerms.ownership.content',
      },
      {
        id: 'liability',
        title: $localize`:@@simTerms.liability.title:12. LIABILITY`,
        titleI18n: '@@simTerms.liability.title',
        content: $localize`:@@simTerms.liability.content:IDEM Simulation is supplied as is. To the fullest extent permitted by the applicable law, IDEM is not liable for any loss arising from a decision taken on the strength of a run, from an inaccuracy in a result, from an estimate that turned out to be wrong, or from the unavailability of the service. Where liability cannot be excluded, it is limited to the amount you actually paid for the run concerned — which, during the beta, is zero. Nothing in this section limits a liability that cannot be limited by law.`,
        contentI18n: '@@simTerms.liability.content',
        warning: {
          type: 'error',
          icon: '🛑',
          title: $localize`:@@simTerms.liability.warning.title:Read before acting on a result`,
          titleI18n: '@@simTerms.liability.warning.title',
          content: $localize`:@@simTerms.liability.warning.content:A simulation exists to sharpen a decision, never to take it. Do not commit money, staff or a debt on the strength of a run alone, and do not present one as an audited financial projection.`,
          contentI18n: '@@simTerms.liability.warning.content',
        },
      },
      {
        id: 'changes',
        title: $localize`:@@simTerms.changes.title:13. CHANGES TO THESE TERMS`,
        titleI18n: '@@simTerms.changes.title',
        content: $localize`:@@simTerms.changes.content:These terms may change as the engine changes. Since acceptance is asked before each run, you always accept the version in force at that moment, and the version you accepted is recorded with the run it authorised. Substantial changes are signalled on this page through its effective date.`,
        contentI18n: '@@simTerms.changes.content',
      },
      {
        id: 'contact',
        title: $localize`:@@simTerms.contact.title:14. CONTACT`,
        titleI18n: '@@simTerms.contact.title',
        content: $localize`:@@simTerms.contact.content:For any question about these terms, about a run, or to ask for the deletion of a project created from an imported business plan, write to contact@idem.africa.`,
        contentI18n: '@@simTerms.contact.content',
      },
    ];
  }
}
