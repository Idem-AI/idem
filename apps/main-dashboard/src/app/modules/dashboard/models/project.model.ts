import { AnalysisResultModel } from './analysisResult.model';

export interface ProjectModel {
  id?: string;
  name: string;
  description: string;
  type: {
    code: string;
    name: string;
  };
  constraints: string[];
  teamSize: string;
  scope: {
    code: string;
    name: string;
  };
  budgetIntervals?: string;
  targets: {
    code: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  selectedPhases: string[];
  analysisResultModel: AnalysisResultModel;
  additionalInfos: {
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    zipCode: string;
    teamMembers: TeamMember[];
  };
}

export interface TeamMember {
  name: string;
  role: string;
  email: string;
  bio: string;
  pictureUrl?: string;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    twitter?: string;
  };
}
