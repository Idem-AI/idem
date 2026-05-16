/**
 * FinancePdfService — génère un rapport financier PDF complet à partir du
 * FinanceModel d'un projet, en s'appuyant sur le PdfService existant
 * (Puppeteer + HTML/Tailwind).
 *
 * Le rapport adopte la charte graphique du projet si disponible, sinon le
 * design system IDEM par défaut.
 */

import logger from '../../config/logger';
import { PdfService } from '../pdf.service';
import { SectionModel } from '../../models/section.model';
import { financeService } from './finance.service';
import { financeAIService } from './finance-ai.service';
import { ProjectModel } from '../../models/project.model';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import {
  FinanceComputed,
  FinanceModel,
  CompteExploitationRow,
  BilanRow,
  FluxTresorerieRow,
  SeuilRentabiliteRow,
} from '../../models/finance.model';
import { TypographyModel } from '../../models/brand-identity.model';
import { AIChatMessage, LLMProvider, PromptConfig, PromptService } from '../prompt.service';

interface BrandPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

const IDEM_DEFAULT_PALETTE: BrandPalette = {
  primary: '#7C5CFC',
  secondary: '#3B82F6',
  accent: '#10B981',
  background: '#0F141B',
  text: '#FFFFFF',
};

export class FinancePdfService {
  private readonly pdfService = new PdfService();
  private readonly promptService = new PromptService();
  private readonly projectRepository = RepositoryFactory.getRepository<ProjectModel>();

  /** Génère un PDF du rapport financier. Renvoie le chemin du fichier généré. */
  async generateFinancePdf(userId: string, projectId: string): Promise<string> {
    logger.info(`FinancePdfService.generateFinancePdf userId=${userId} projectId=${projectId}`);

    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const finance = await financeService.getFinance(userId, projectId);
    if (!finance || !finance.computed) {
      throw new Error(
        'Aucune donnée financière disponible. Veuillez d\u2019abord remplir le module Finance.',
      );
    }

    const palette = this.extractPalette(project);
    const typography = this.extractTypography(project);
    const logoSvg = this.extractLogoSvg(project);
    const companyName = project.name || 'Projet';
    const interpretation = await this.generateInterpretation(project, finance);

    // Construit les sections HTML
    const sections: SectionModel[] = [
      this.buildCoverSection(companyName, palette, logoSvg),
      this.buildSummarySection(finance, palette),
      this.buildProductsSection(finance, palette),
      this.buildExploitationSection(finance.computed.compteExploitation, palette),
      this.buildBilanSection(finance.computed.bilan, palette),
      this.buildCashflowSection(finance.computed.fluxTresorerie, palette),
      this.buildSeuilSection(finance.computed.seuilRentabilite, palette),
      this.buildRatiosSection(finance, palette),
      this.buildInterpretationSection(interpretation, palette),
    ];

    return this.pdfService.generatePdf({
      title: 'Rapport financier',
      projectName: companyName,
      projectDescription: project.description || '',
      sections,
      footerText: `Rapport financier — ${companyName} — Généré par Idem`,
      typography: typography,
    });
  }

  // -----------------------------------------------------------------
  // Brand & utilities
  // -----------------------------------------------------------------

  private extractPalette(project: ProjectModel): BrandPalette {
    const colors: any = project.analysisResultModel?.branding?.colors;
    if (!colors) return IDEM_DEFAULT_PALETTE;
    return {
      primary: colors.primary || IDEM_DEFAULT_PALETTE.primary,
      secondary: colors.secondary || IDEM_DEFAULT_PALETTE.secondary,
      accent: colors.accent || IDEM_DEFAULT_PALETTE.accent,
      background: colors.background || IDEM_DEFAULT_PALETTE.background,
      text: colors.text || IDEM_DEFAULT_PALETTE.text,
    };
  }

  private extractTypography(project: ProjectModel): TypographyModel | undefined {
    return project.analysisResultModel?.branding?.typography;
  }

  private extractLogoSvg(project: ProjectModel): string | null {
    return project.analysisResultModel?.branding?.logo?.svg || null;
  }

  private fmt(value: number): string {
    if (!Number.isFinite(value)) return '—';
    const rounded = Math.round(value);
    return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  }

  private pct(value: number): string {
    return Number.isFinite(value) ? `${value.toFixed(1)} %` : '—';
  }

  // -----------------------------------------------------------------
  // Section builders (chaque section retourne un SectionModel)
  // -----------------------------------------------------------------

  private buildCoverSection(companyName: string, p: BrandPalette, logoSvg: string | null): SectionModel {
    const today = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    let logoHtml = '';
    if (logoSvg) {
      logoHtml = `<div style="max-width: 250px; max-height: 250px; margin-bottom: 32px; display: flex; justify-content: center; align-items: center;">${logoSvg}</div>`;
    }

    const html = `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;background:linear-gradient(135deg,${p.primary} 0%,${p.secondary} 100%);color:#fff;padding:48px;font-family: 'primary', sans-serif;">
      ${logoHtml}
      <div style="opacity:0.7;letter-spacing:6px;font-size:14px;text-transform:uppercase;">Rapport financier</div>
      <h1 style="font-size:56px;font-weight:800;margin:24px 0 12px;text-align:center;">${this.esc(companyName)}</h1>
      <p style="font-size:18px;opacity:0.9;">Prévisions financières sur 3 ans</p>
      <div style="position:absolute;bottom:48px;font-size:13px;opacity:0.7;">${today}</div>
    </div>`;
    return { name: 'Couverture', type: 'cover', data: html, summary: '' };
  }

  private buildSummarySection(finance: FinanceModel, p: BrandPalette): SectionModel {
    const c = finance.computed!;
    const ce0 = c.compteExploitation[0];
    const ce2 = c.compteExploitation[2];
    const flux1 = c.fluxTresorerie[0];
    const seuil1 = c.seuilRentabilite[0];
    const ratios = c.ratios;

    const kpi = (label: string, value: string, color = p.primary) => `
      <div style="background:#F8FAFC;border-left:4px solid ${color};padding:14px 16px;border-radius:6px;">
        <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${label}</div>
        <div style="font-size:20px;font-weight:700;color:#0F172A;margin-top:6px;">${value}</div>
      </div>`;

    const html = `<div style="padding:32px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;">
      <h2 style="font-size:32px;font-weight:800;margin:0 0 4px;color:${p.primary};">Synthèse financière</h2>
      <p style="color:#64748B;margin:0 0 32px;">Indicateurs clés des 3 premières années d'exploitation</p>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
        ${kpi('CA An 1', this.fmt(ce0?.chiffreAffaires || 0))}
        ${kpi('Résultat net An 3', this.fmt(ce2?.resultatNet || 0), ce2?.resultatNet >= 0 ? p.accent : '#EF4444')}
        ${kpi('Marge brute An 1', this.pct(ce0?.tauxMargePct || 0))}
        ${kpi('Trésorerie clôture An 1', this.fmt(flux1?.tresorerieCloture || 0), flux1?.tresorerieCloture >= 0 ? p.accent : '#EF4444')}
        ${kpi('Point mort', `${Math.round(seuil1?.pointMortJours || 0)} jours`)}
        ${kpi('BFR', this.fmt(c.bfr.monthlyBfr[c.bfr.monthlyBfr.length - 1] || 0))}
        ${kpi('Coût total du projet', this.fmt(c.financing.coutTotalProjet))}
        ${kpi('TRI', this.pct(ratios.tri), p.accent)}
        ${kpi('VAN', this.fmt(ratios.van), ratios.van >= 0 ? p.accent : '#EF4444')}
      </div>

      <div style="margin-bottom: 28px; width: 100%; height: 250px;">
        <canvas id="caChart"></canvas>
      </div>
      <script>
        new Chart(document.getElementById('caChart'), {
          type: 'bar',
          data: {
            labels: ['An 1', 'An 2', 'An 3'],
            datasets: [
              { label: "Chiffre d'affaires", data: [${c.compteExploitation.map(r => r.chiffreAffaires).join(',')}], backgroundColor: '${p.primary}' },
              { label: 'Résultat net', data: [${c.compteExploitation.map(r => r.resultatNet).join(',')}], backgroundColor: '${p.accent}' }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, animation: false }
        });
      </script>

      <h3 style="font-size:18px;font-weight:700;margin:24px 0 12px;color:${p.primary};">Évolution sur 3 ans</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:${p.primary};color:#fff;">
            <th style="padding:10px;text-align:left;">Année</th>
            <th style="padding:10px;text-align:right;">Chiffre d'affaires</th>
            <th style="padding:10px;text-align:right;">Marge brute</th>
            <th style="padding:10px;text-align:right;">EBE</th>
            <th style="padding:10px;text-align:right;">Résultat net</th>
          </tr>
        </thead>
        <tbody>
          ${c.compteExploitation
            .map(
              (row, i) => `
            <tr style="border-bottom:1px solid #E2E8F0;background:${i % 2 ? '#F8FAFC' : '#FFFFFF'};">
              <td style="padding:10px;font-weight:600;">An ${row.year}</td>
              <td style="padding:10px;text-align:right;">${this.fmt(row.chiffreAffaires)}</td>
              <td style="padding:10px;text-align:right;">${this.fmt(row.margeBrute)}</td>
              <td style="padding:10px;text-align:right;">${this.fmt(row.ebe)}</td>
              <td style="padding:10px;text-align:right;font-weight:600;color:${row.resultatNet >= 0 ? p.accent : '#EF4444'};">${this.fmt(row.resultatNet)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
    return { name: 'Synthèse financière', type: 'finance-summary', data: html, summary: '' };
  }

  private buildProductsSection(finance: FinanceModel, p: BrandPalette): SectionModel {
    const rows = finance.products
      .map(
        (prod, i) => `
        <tr style="border-bottom:1px solid #E2E8F0;background:${i % 2 ? '#F8FAFC' : '#FFFFFF'};">
          <td style="padding:10px;font-weight:600;">${this.esc(prod.name)}</td>
          <td style="padding:10px;text-align:right;">${this.fmt(prod.prices?.[0] || 0)}</td>
          <td style="padding:10px;text-align:right;">${this.fmt(prod.prices?.[1] || 0)}</td>
          <td style="padding:10px;text-align:right;">${this.fmt(prod.prices?.[2] || 0)}</td>
          <td style="padding:10px;text-align:right;color:#64748B;">${this.fmt(prod.unitCosts?.[0] || 0)}</td>
        </tr>`,
      )
      .join('');

    const html = `<div style="padding:32px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;">
      <h2 style="font-size:32px;font-weight:800;margin:0 0 4px;color:${p.primary};">Produits & Prix</h2>
      <p style="color:#64748B;margin:0 0 28px;">Catalogue commercial sur 3 ans</p>
      ${
        finance.products.length === 0
          ? '<p style="color:#94A3B8;font-style:italic;">Aucun produit défini.</p>'
          : `<table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:${p.primary};color:#fff;">
                  <th style="padding:10px;text-align:left;">Produit</th>
                  <th style="padding:10px;text-align:right;">Prix An 1</th>
                  <th style="padding:10px;text-align:right;">Prix An 2</th>
                  <th style="padding:10px;text-align:right;">Prix An 3</th>
                  <th style="padding:10px;text-align:right;">Coût unitaire An 1</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>`
      }
    </div>`;
    return { name: 'Produits & Prix', type: 'finance-products', data: html, summary: '' };
  }

  private buildExploitationSection(rows: CompteExploitationRow[], p: BrandPalette): SectionModel {
    const lines = [
      { label: 'Chiffre d\'affaires', key: 'chiffreAffaires' },
      { label: 'Charges variables', key: 'chargesVariables' },
      { label: 'Marge brute', key: 'margeBrute', bold: true },
      { label: 'Charges fixes', key: 'chargesFixes' },
      { label: 'Rémunérations', key: 'remunerations' },
      { label: 'Impôts & taxes', key: 'impotsTaxes' },
      { label: 'EBE', key: 'ebe', bold: true },
      { label: 'Dotations amortissements', key: 'dotationsAmortissements' },
      { label: 'Résultat exploitation', key: 'resultatExploitation' },
      { label: 'Charges financières', key: 'chargesFinancieres' },
      { label: 'Résultat avant impôt', key: 'resultatAvantImpot' },
      { label: 'IS', key: 'is' },
      { label: 'Résultat net', key: 'resultatNet', bold: true, highlight: true },
    ];

    const html = `<div style="padding:32px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;">
      <h2 style="font-size:32px;font-weight:800;margin:0 0 4px;color:${p.primary};">Compte d'exploitation prévisionnel</h2>
      <p style="color:#64748B;margin:0 0 28px;">Cascade des résultats sur ${rows.length} ans</p>

      <div style="margin-bottom: 28px; width: 100%; height: 250px; display: flex; justify-content: center;">
        <canvas id="chargesChart"></canvas>
      </div>
      <script>
        new Chart(document.getElementById('chargesChart'), {
          type: 'doughnut',
          data: {
            labels: ['Charges Variables (An 1)', 'Charges Fixes (An 1)', 'Rémunérations (An 1)', 'Impôts & Taxes (An 1)'],
            datasets: [{
              data: [${rows[0]?.chargesVariables || 0}, ${rows[0]?.chargesFixes || 0}, ${rows[0]?.remunerations || 0}, ${rows[0]?.impotsTaxes || 0}],
              backgroundColor: ['${p.primary}', '${p.secondary}', '${p.accent}', '#F59E0B']
            }]
          },
          options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            animation: false,
            plugins: {
              legend: { position: 'right' }
            }
          }
        });
      </script>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:${p.primary};color:#fff;">
            <th style="padding:10px;text-align:left;">Poste</th>
            ${rows.map((r) => `<th style="padding:10px;text-align:right;">An ${r.year}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${lines
            .map(
              (line, i) => `
            <tr style="border-bottom:1px solid #E2E8F0;background:${
              line.highlight ? `${p.accent}15` : i % 2 ? '#F8FAFC' : '#FFFFFF'
            };">
              <td style="padding:9px;${line.bold ? 'font-weight:700;' : ''}">${line.label}</td>
              ${rows
                .map((r) => {
                  const v = (r as any)[line.key] || 0;
                  return `<td style="padding:9px;text-align:right;${line.bold ? 'font-weight:700;' : ''}">${this.fmt(v)}</td>`;
                })
                .join('')}
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
    return { name: 'Compte d\'exploitation', type: 'finance-exploitation', data: html, summary: '' };
  }

  private buildBilanSection(rows: BilanRow[], p: BrandPalette): SectionModel {
    const html = `<div style="padding:32px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;">
      <h2 style="font-size:32px;font-weight:800;margin:0 0 4px;color:${p.primary};">Bilan prévisionnel</h2>
      <p style="color:#64748B;margin:0 0 28px;">Actif et passif simplifiés sur ${rows.length} ans</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div>
          <h3 style="font-size:14px;font-weight:700;color:${p.primary};text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid ${p.primary};padding-bottom:6px;">Actif</h3>
          <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;">
            ${this.bilanRowsHtml(rows, [
              ['Trésorerie', 'tresorerie'],
              ['Créances clients', 'creancesClients'],
              ['Stocks', 'stocks'],
              ['Total actifs circulants', 'totalActifsCirculants'],
              ['Immobilisations brutes', 'immobilisationsBrutes'],
              ['Amortissements cumulés', 'amortissementsCumules'],
              ['VNC', 'vnc'],
              ['Total actif', 'totalActif'],
            ], p, ['Total actif'])}
          </table>
        </div>
        <div>
          <h3 style="font-size:14px;font-weight:700;color:${p.primary};text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid ${p.primary};padding-bottom:6px;">Passif</h3>
          <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;">
            ${this.bilanRowsHtml(rows, [
              ['Dettes fournisseurs', 'dettesFournisseurs'],
              ['Dettes fiscales/sociales', 'dettesFiscalesSociales'],
              ['Emprunts', 'emprunts'],
              ['Total dettes', 'totalDettes'],
              ['Capital social', 'capitalSocial'],
              ['Report à nouveau', 'reportANouveau'],
              ['Résultat de l\'exercice', 'resultatExercice'],
              ['Fonds propres', 'fondsPropres'],
              ['Total passif', 'totalPassif'],
            ], p, ['Total passif'])}
          </table>
        </div>
      </div>
    </div>`;
    return { name: 'Bilan prévisionnel', type: 'finance-bilan', data: html, summary: '' };
  }

  private bilanRowsHtml(
    rows: BilanRow[],
    fields: Array<[string, keyof BilanRow]>,
    p: BrandPalette,
    boldLabels: string[],
  ): string {
    return `
      <thead>
        <tr style="background:${p.primary}15;">
          <th style="padding:6px;text-align:left;font-size:10px;text-transform:uppercase;">Poste</th>
          ${rows.map((r) => `<th style="padding:6px;text-align:right;font-size:10px;">An ${r.year}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${fields
          .map(
            ([label, key], i) => `
          <tr style="border-bottom:1px solid #E2E8F0;${boldLabels.includes(label) ? 'font-weight:700;background:#F1F5F9;' : i % 2 ? 'background:#F8FAFC;' : ''}">
            <td style="padding:6px;">${label}</td>
            ${rows
              .map((r) => `<td style="padding:6px;text-align:right;">${this.fmt((r as any)[key] || 0)}</td>`)
              .join('')}
          </tr>`,
          )
          .join('')}
      </tbody>`;
  }

  private buildCashflowSection(rows: FluxTresorerieRow[], p: BrandPalette): SectionModel {
    const html = `<div style="padding:32px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;">
      <h2 style="font-size:32px;font-weight:800;margin:0 0 4px;color:${p.primary};">Flux de trésorerie</h2>
      <p style="color:#64748B;margin:0 0 28px;">Méthode OEC sur ${rows.length} ans</p>

      <div style="margin-bottom: 28px; width: 100%; height: 250px;">
        <canvas id="cashflowChart"></canvas>
      </div>
      <script>
        new Chart(document.getElementById('cashflowChart'), {
          type: 'line',
          data: {
            labels: ['An 1', 'An 2', 'An 3'],
            datasets: [
              { 
                label: 'Trésorerie clôture', 
                data: [${rows.map(r => r.tresorerieCloture).join(',')}], 
                borderColor: '${p.primary}',
                backgroundColor: '${p.primary}33',
                fill: true,
                tension: 0.4
              }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, animation: false }
        });
      </script>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:${p.primary};color:#fff;">
            <th style="padding:10px;text-align:left;">Flux</th>
            ${rows.map((r) => `<th style="padding:10px;text-align:right;">An ${r.year}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${[
            ['Flux exploitation', 'fluxExploitation'],
            ['Flux investissement', 'fluxInvestissement'],
            ['Flux financement', 'fluxFinancement'],
            ['Variation trésorerie', 'variationTresorerie'],
            ['Trésorerie ouverture', 'tresorerieOuverture'],
            ['Trésorerie clôture', 'tresorerieCloture'],
          ]
            .map(
              ([label, key], i) => `
            <tr style="border-bottom:1px solid #E2E8F0;background:${
              label === 'Trésorerie clôture' ? `${p.accent}15` : i % 2 ? '#F8FAFC' : '#FFFFFF'
            };${label === 'Trésorerie clôture' ? 'font-weight:700;' : ''}">
              <td style="padding:9px;">${label}</td>
              ${rows
                .map((r) => {
                  const v = (r as any)[key as string] || 0;
                  const color =
                    label === 'Trésorerie clôture' && v < 0 ? '#EF4444' : 'inherit';
                  return `<td style="padding:9px;text-align:right;color:${color};">${this.fmt(v)}</td>`;
                })
                .join('')}
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
    return { name: 'Flux de trésorerie', type: 'finance-cashflow', data: html, summary: '' };
  }

  private buildSeuilSection(rows: SeuilRentabiliteRow[], p: BrandPalette): SectionModel {
    const html = `<div style="padding:32px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;">
      <h2 style="font-size:32px;font-weight:800;margin:0 0 4px;color:${p.primary};">Seuil de rentabilité & Point mort</h2>
      <p style="color:#64748B;margin:0 0 28px;">Niveau de CA à atteindre pour couvrir les charges</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:${p.primary};color:#fff;">
            <th style="padding:10px;text-align:left;">Année</th>
            <th style="padding:10px;text-align:right;">Charges fixes</th>
            <th style="padding:10px;text-align:right;">Taux marge CV</th>
            <th style="padding:10px;text-align:right;">Seuil rentabilité</th>
            <th style="padding:10px;text-align:right;">Point mort (jours)</th>
            <th style="padding:10px;text-align:right;">% du CA</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r, i) => `
            <tr style="border-bottom:1px solid #E2E8F0;background:${i % 2 ? '#F8FAFC' : '#FFFFFF'};">
              <td style="padding:10px;font-weight:600;">An ${r.year}</td>
              <td style="padding:10px;text-align:right;">${this.fmt(r.chargesFixes)}</td>
              <td style="padding:10px;text-align:right;">${this.pct(r.tauxMargeCoutsVariablesPct)}</td>
              <td style="padding:10px;text-align:right;font-weight:600;">${this.fmt(r.seuilRentabilite)}</td>
              <td style="padding:10px;text-align:right;">${Math.round(r.pointMortJours)}</td>
              <td style="padding:10px;text-align:right;">${this.pct(r.partSeuilDansCAPct)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
    return { name: 'Seuil de rentabilité', type: 'finance-seuil', data: html, summary: '' };
  }

  private buildRatiosSection(finance: FinanceModel, p: BrandPalette): SectionModel {
    const r = finance.computed!.ratios;
    const card = (title: string, value: string, hint: string, color: string) => `
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:4px solid ${color};padding:18px;border-radius:8px;">
        <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${title}</div>
        <div style="font-size:28px;font-weight:800;color:#0F172A;margin:8px 0 4px;">${value}</div>
        <div style="font-size:11px;color:#94A3B8;">${hint}</div>
      </div>`;
    const html = `<div style="padding:32px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;">
      <h2 style="font-size:32px;font-weight:800;margin:0 0 4px;color:${p.primary};">Ratios & Indicateurs financiers</h2>
      <p style="color:#64748B;margin:0 0 28px;">Évaluation de la rentabilité et de la création de valeur</p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:24px;">
        ${card('VAN', this.fmt(r.van), 'Valeur Actuelle Nette (taux ' + finance.ratiosParams.vanDiscountRatePct + ' %)', r.van >= 0 ? p.accent : '#EF4444')}
        ${card('TRI', this.pct(r.tri), 'Taux de Rendement Interne', p.primary)}
        ${card('DRCI', `${r.drci.toFixed(2)} ans`, 'Délai de Récupération du Capital Investi', p.secondary)}
        ${card('Indice profitabilité', r.indiceProfitabilite.toFixed(2), 'IP > 1 → projet créateur de valeur', r.indiceProfitabilite >= 1 ? p.accent : '#EF4444')}
      </div>

      <h3 style="font-size:16px;font-weight:700;color:${p.primary};margin:24px 0 12px;">Évaluation DCF</h3>
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;padding:16px;border-radius:6px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
          <div><strong>Flux normatif:</strong> ${this.fmt(r.dcf.fluxNormatif)}</div>
          <div><strong>Valeur terminale actualisée:</strong> ${this.fmt(r.dcf.valeurTerminale)}</div>
          <div><strong>CMPC:</strong> ${this.pct(finance.ratiosParams.cmpcPct)}</div>
          <div><strong>Croissance à l'infini:</strong> ${this.pct(finance.ratiosParams.perpetualGrowthRatePct)}</div>
        </div>
        <div style="margin-top:14px;padding-top:14px;border-top:2px solid ${p.primary};">
          <div style="font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Valeur totale de l'entreprise</div>
          <div style="font-size:24px;font-weight:800;color:${p.primary};margin-top:4px;">${this.fmt(r.dcf.valeurTotaleEntreprise)}</div>
        </div>
      </div>
    </div>`;
    return { name: 'Ratios & Indicateurs', type: 'finance-ratios', data: html, summary: '' };
  }

  private buildInterpretationSection(text: string, p: BrandPalette): SectionModel {
    const paragraphs = text
      .split(/\n+/)
      .filter((s) => s.trim())
      .map((s) => `<p style="margin:0 0 12px;line-height:1.6;color:#334155;">${this.esc(s)}</p>`)
      .join('');
    const html = `<div style="padding:32px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;">
      <h2 style="font-size:32px;font-weight:800;margin:0 0 4px;color:${p.primary};">Analyse & Recommandations</h2>
      <p style="color:#64748B;margin:0 0 28px;">Interprétation des indicateurs et points de vigilance identifiés par l'IA</p>
      <div style="background:#F8FAFC;border-left:4px solid ${p.primary};padding:24px;border-radius:6px;">
        ${paragraphs || '<p style="color:#94A3B8;">Aucune analyse disponible pour le moment.</p>'}
      </div>
    </div>`;
    return { name: 'Analyse & Recommandations', type: 'finance-interpretation', data: html, summary: '' };
  }

  // -----------------------------------------------------------------
  // AI interpretation
  // -----------------------------------------------------------------

  private async generateInterpretation(
    project: ProjectModel,
    finance: FinanceModel,
  ): Promise<string> {
    const c = finance.computed!;
    const ce = c.compteExploitation;
    const summary = [
      `Projet: ${project.name}`,
      `Type: ${project.type}`,
      `CA An 1/2/3: ${ce[0]?.chiffreAffaires} / ${ce[1]?.chiffreAffaires} / ${ce[2]?.chiffreAffaires} FCFA`,
      `Résultat net An 1/2/3: ${ce[0]?.resultatNet} / ${ce[1]?.resultatNet} / ${ce[2]?.resultatNet} FCFA`,
      `Marge brute An 1: ${ce[0]?.tauxMargePct?.toFixed(1)}%`,
      `Point mort An 1: ${c.seuilRentabilite[0]?.pointMortJours?.toFixed(0)} jours`,
      `Trésorerie clôture An 1: ${c.fluxTresorerie[0]?.tresorerieCloture} FCFA`,
      `TRI: ${c.ratios.tri.toFixed(1)}%, VAN: ${c.ratios.van.toFixed(0)} FCFA`,
      `Coût total projet: ${c.financing.coutTotalProjet} FCFA`,
    ].join('\n');

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content: `Tu es un analyste financier qui rédige des interprétations claires et actionnables
pour un porteur de projet africain. Réponds en français, ton professionnel mais pédagogique.
Structure ta réponse en 4 paragraphes:
1) Bilan global de la rentabilité du projet
2) Points forts identifiés
3) Points de vigilance (trésorerie, point mort, charges, etc.)
4) Recommandations actionnables
NE renvoie PAS de markdown, juste du texte avec des sauts de ligne entre paragraphes.`,
      },
      { role: 'user', content: `Indicateurs:\n${summary}\n\nRédige l'analyse.` },
    ];

    const config: PromptConfig = {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      promptType: 'finance-pdf-interpretation',
      llmOptions: { temperature: 0.5, maxOutputTokens: 1500 },
    };
    try {
      const raw = await this.promptService.runPrompt(config, messages);
      return this.promptService.getCleanAIText(raw).trim();
    } catch (err: any) {
      logger.warn(`FinancePdf.interpretation failed: ${err?.message}`);
      return 'L\u2019analyse automatique n\u2019a pas pu être générée pour ce rapport. Les indicateurs ci-avant offrent néanmoins une vue complète de la santé financière prévisionnelle du projet.';
    }
  }

  private esc(s: string): string {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const financePdfService = new FinancePdfService();
