/**
 * UN PROJET IDEM À PARTIR D'UNE DEMANDE DE SITE — « je veux un site de vente de poulet, ça s'appelle Rocky », écrit
 * sur l'accueil d'iCode. Après l'accord de l'utilisateur, la demande devient un projet complet, comme s'il l'avait
 * créé dans IDEM :
 *
 *   1. la FICHE (`createProjectFromPrompt`) : nom, description courte et détaillée, type, cible, portée, rédigés
 *      depuis la demande — une demande de quatre mots donne une fiche juste mais prudente, jamais un fait inventé ;
 *   2. l'IDENTITÉ (`ensurePromptIdentity`) : palette, typographie et direction artistique, par les mêmes générateurs
 *      que le dashboard. Sans elle, le moteur des sites tirait une couleur et des polices au hasard du nom.
 *
 * Le logo n'est pas généré ici (plusieurs minutes, choix de l'utilisateur) : l'en-tête porte le nom, et la charte se
 * fait ensuite depuis iCode (`/charter`) ou IDEM.
 */
import logger from '../../config/logger';
import type { ProjectModel } from '../../models/project.model';
import type { ColorModel, TypographyModel } from '../../models/brand-identity.model';
import { projectService } from '../project.service';
import { PromptService } from '../prompt.service';
import { BrandingService } from '../BandIdentity/branding.service';
import { parseLlmJson } from '../../utils/llm-json.util';
import { recordConsent, type SiteConsent, type SiteImportPorts } from './siteProject.service';

const PROJECT_TYPES: ProjectModel['type'][] = ['enterprise', 'ecommerce', 'web', 'landing', 'other'];
const TARGETS = ['business', 'students', 'general-public', 'government', 'healthcare'];
const SCOPES = ['local', 'departmental', 'regional', 'national', 'international'];

interface PromptSheet {
  name: string;
  description: string;
  longDescription: string;
  type: ProjectModel['type'];
  targets: string;
  scope: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
}

/** Ce qui est écrit dans la demande (un téléphone, un e-mail) : gardé seulement s'il y figure tel quel. */
function stated(value: string | undefined, request: string): string | undefined {
  if (!value) return undefined;
  const digits = (s: string) => s.replace(/\D/g, '');
  if (/@/.test(value)) return request.toLowerCase().includes(value.toLowerCase()) ? value : undefined;
  const d = digits(value);
  return d.length >= 6 && digits(request).includes(d) ? value : undefined;
}

async function describeRequest(request: string, language: 'fr' | 'en', ports: Pick<SiteImportPorts, 'text'>): Promise<PromptSheet> {
  const fallback: PromptSheet = {
    name: language === 'fr' ? 'Mon entreprise' : 'My business',
    description: request.slice(0, 190),
    longDescription: request.slice(0, 3000),
    type: 'enterprise',
    targets: 'general-public',
    scope: 'local',
  };
  const system = [
    'You turn a short request for a showcase website into the project sheet of a business-building platform. Answer ONLY a JSON object:',
    '{"name": "the business name given in the request, else a short fitting brand name (1 to 3 words)", "description": "one sentence, at most 180 characters: what the business does and for whom", "longDescription": "80 to 180 words: the activity, the kind of products or services such a business offers, who its customers are, the tone it should have — written as a brief for a designer", "type": "enterprise|ecommerce|landing|other", "targets": "business|general-public|students|government|healthcare", "scope": "local|regional|national|international", "city": "city if the request states it, else null", "country": "country if the request states it, else null", "email": "e-mail exactly as written in the request, else null", "phone": "phone number exactly as written in the request, else null"}',
    'The request is often a few words: fill the sheet with what such a business plausibly is, in general terms.',
    `Write the texts in ${language === 'fr' ? 'French' : 'English'}. Never invent a price, a figure, a date, a client, an award, an address or a phone number.`,
  ].join('\n');
  try {
    const json = parseLlmJson<Record<string, unknown>>(await ports.text(system, `REQUEST: """${request.slice(0, 3000)}"""`, 'writing'));
    if (!json) return fallback;
    const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && !/^null$/i.test(v.trim()) ? v.trim().slice(0, max) : undefined);
    return {
      name: str(json.name, 60)?.replace(/^["«]|["»]$/g, '') || fallback.name,
      description: str(json.description, 195) || fallback.description,
      // La demande telle qu'écrite reste en tête : c'est le seul texte de l'utilisateur.
      longDescription: [request.trim(), str(json.longDescription, 3000)].filter(Boolean).join('\n\n').slice(0, 6000),
      type: PROJECT_TYPES.includes(json.type as ProjectModel['type']) ? (json.type as ProjectModel['type']) : fallback.type,
      targets: TARGETS.includes(String(json.targets)) ? String(json.targets) : fallback.targets,
      scope: SCOPES.includes(String(json.scope)) ? String(json.scope) : fallback.scope,
      ...(str(json.city, 60) ? { city: str(json.city, 60) } : {}),
      ...(str(json.country, 60) ? { country: str(json.country, 60) } : {}),
      ...(stated(str(json.email, 120), request) ? { email: str(json.email, 120) } : {}),
      ...(stated(str(json.phone, 40), request) ? { phone: str(json.phone, 40) } : {}),
    };
  } catch (error: any) {
    logger.warn('prompt_project.describe_failed', { event: 'prompt_project.describe_failed', error: error?.message });
    return fallback;
  }
}

/** Crée le projet IDEM d'une demande de site, accord enregistré. */
export async function createProjectFromPrompt(
  userId: string,
  request: string,
  language: 'fr' | 'en',
  consent: SiteConsent,
  ports: Pick<SiteImportPorts, 'text'>
): Promise<ProjectModel> {
  const sheet = await describeRequest(request, language, ports);
  const created = await projectService.createUserProject(userId, {
    name: sheet.name,
    description: sheet.description,
    longDescription: sheet.longDescription,
    type: sheet.type,
    targets: sheet.targets,
    scope: sheet.scope,
    teamSize: '',
    constraints: [],
    selectedPhases: [],
    analysisResultModel: {} as ProjectModel['analysisResultModel'],
    deployments: [],
    activeChatMessages: [],
    additionalInfos: { email: sheet.email || '', phone: sheet.phone || '', address: '', city: sheet.city || '', country: sheet.country || '', zipCode: '', teamMembers: [] },
    project: undefined,
  } as unknown as ProjectModel);
  const projectId = created.id as string;
  await recordConsent(userId, projectId, consent);
  logger.info('prompt_project.created', { event: 'prompt_project.created', projectId, name: sheet.name });
  return created;
}

/**
 * Donne au projet sa palette, sa typographie et sa direction artistique s'il n'en a pas. Une palette ou des polices
 * déjà choisies dans IDEM restent les siennes.
 */
export async function ensurePromptIdentity(userId: string, projectId: string): Promise<ProjectModel | null> {
  const project = await projectService.getUserProjectById(userId, projectId);
  if (!project) return null;
  const brandingService = new BrandingService(new PromptService());
  const has = (p: ProjectModel) => ({
    colors: !!p.analysisResultModel?.branding?.colors?.colors?.primary,
    typography: !!p.analysisResultModel?.branding?.typography?.primaryFont,
  });

  if (!has(project).colors || !has(project).typography) {
    const generated = await brandingService.generateColorsAndTypography(userId, project);
    // Relu après l'appel au modèle : seules la palette et la typographie retenues s'écrivent.
    const fresh = (await projectService.getUserProjectById(userId, projectId)) ?? project;
    const branding = (fresh.analysisResultModel?.branding ?? {}) as Record<string, any>;
    const colors: ColorModel | undefined = has(fresh).colors ? branding.colors : generated.colors[0];
    const typography: TypographyModel | undefined = has(fresh).typography ? branding.typography : generated.typography[0];
    await projectService.editUserProject(userId, projectId, {
      analysisResultModel: {
        ...(fresh.analysisResultModel ?? {}),
        branding: {
          ...branding,
          ...(colors ? { colors } : {}),
          ...(typography ? { typography } : {}),
          generatedColors: branding.generatedColors?.length ? branding.generatedColors : generated.colors,
          generatedTypography: branding.generatedTypography?.length ? branding.generatedTypography : generated.typography,
        },
      } as unknown as ProjectModel['analysisResultModel'],
    });
  }

  const branded = await projectService.getUserProjectById(userId, projectId);
  if (!branded) return null;
  await brandingService.ensureArtDirection(userId, projectId, branded);
  const final = await projectService.getUserProjectById(userId, projectId);
  logger.info('prompt_project.identity_ready', {
    event: 'prompt_project.identity_ready',
    projectId,
    primary: final?.analysisResultModel?.branding?.colors?.colors?.primary,
    display: final?.analysisResultModel?.branding?.typography?.primaryFont,
    artDirection: final?.analysisResultModel?.branding?.artDirection?.styleId,
  });
  return final;
}
