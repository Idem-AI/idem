import { SelectItemGroup } from 'primeng/api';

export interface PhaseItem {
  label: string;
  tier: 'free' | 'standard' | 'premium'; // f, s, p
}

export interface DevelopmentPhase {
  id: string;
  label: string;
  tier: 'free' | 'standard' | 'premium'; // Niveau global de la phase
  subItems: PhaseItem[];
}
export interface SelectElement {
  name: string;
  code: string;
}

export default class CreateProjectDatas {
  static groupedProjectTypes: SelectElement[] = [
    { name: 'Enterprise creation', code: 'enterprise' },
    { name: 'Web Application', code: 'web' },
    { name: 'Mobile Application', code: 'mobile' },
    { name: 'IoT', code: 'iot' },
    { name: 'Desktop Application', code: 'desktop' },
    { name: 'API/Backend', code: 'api' },
    { name: 'AI/ML', code: 'ai' },
    { name: 'Blockchain', code: 'blockchain' },
  ];

  static groupedTargets: SelectElement[] = [
    { name: 'Companies', code: 'business' },
    { name: 'Students', code: 'students' },
    { name: 'General Public', code: 'general-public' },
    { name: 'Administrations', code: 'government' },
    { name: 'Healthcare Professionals', code: 'healthcare' },
  ];

  static groupedScopes: SelectElement[] = [
    { name: 'Local', code: 'local' },
    { name: 'Departmental', code: 'departmental' },
    { name: 'Regional', code: 'regional' },
    { name: 'National', code: 'national' },
    { name: 'International', code: 'international' },
  ];
}
