/**
 * Analytics Event Models
 * Defines all trackable events and their parameters for Firebase Analytics
 */

// Standard Firebase Analytics event names
export enum AnalyticsEvent {
  // Page views
  PAGE_VIEW = 'page_view',
  
  // User engagement
  USER_ENGAGEMENT = 'user_engagement',
  SESSION_START = 'session_start',
  
  // Authentication events
  LOGIN = 'login',
  SIGN_UP = 'sign_up',
  LOGOUT = 'logout',
  
  // Project lifecycle events
  PROJECT_CREATED = 'project_created',
  PROJECT_VIEWED = 'project_viewed',
  PROJECT_UPDATED = 'project_updated',
  PROJECT_DELETED = 'project_deleted',
  
  // Branding events
  BRANDING_STARTED = 'branding_started',
  BRANDING_COMPLETED = 'branding_completed',
  LOGO_GENERATED = 'logo_generated',
  LOGO_SELECTED = 'logo_selected',
  COLOR_SELECTED = 'color_selected',
  TYPOGRAPHY_SELECTED = 'typography_selected',
  
  // Business plan events
  BUSINESS_PLAN_STARTED = 'business_plan_started',
  BUSINESS_PLAN_COMPLETED = 'business_plan_completed',
  BUSINESS_PLAN_EXPORTED = 'business_plan_exported',
  
  // Diagram events
  DIAGRAM_STARTED = 'diagram_started',
  DIAGRAM_COMPLETED = 'diagram_completed',
  DIAGRAM_TYPE_SELECTED = 'diagram_type_selected',
  
  // Development events
  DEVELOPMENT_CONFIG_STARTED = 'development_config_started',
  DEVELOPMENT_CONFIG_COMPLETED = 'development_config_completed',
  FRAMEWORK_SELECTED = 'framework_selected',
  LANGUAGE_SELECTED = 'language_selected',
  
  // Deployment events
  DEPLOYMENT_STARTED = 'deployment_started',
  DEPLOYMENT_COMPLETED = 'deployment_completed',
  DEPLOYMENT_MODE_SELECTED = 'deployment_mode_selected',
  CLOUD_PROVIDER_SELECTED = 'cloud_provider_selected',
  
  // Conversion events
  TRIAL_STARTED = 'trial_started',
  PURCHASE = 'purchase',
  SUBSCRIPTION_STARTED = 'subscription_started',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  
  // Feature usage
  FEATURE_USED = 'feature_used',
  EXPORT_PDF = 'export_pdf',
  EXPORT_JSON = 'export_json',
  
  // Errors
  ERROR_OCCURRED = 'error_occurred',
  GENERATION_FAILED = 'generation_failed',
}

// Event parameter interfaces
export interface PageViewParams {
  page_title: string;
  page_location: string;
  page_path: string;
}

export interface ProjectEventParams {
  project_id: string;
  project_name?: string;
  project_type?: string;
}

export interface BrandingEventParams {
  project_id: string;
  generation_duration?: number;
  selected_color?: string;
  selected_typography?: string;
  logo_count?: number;
}

export interface BusinessPlanEventParams {
  project_id: string;
  generation_duration?: number;
  export_format?: 'pdf' | 'json';
  sections_count?: number;
}

export interface DiagramEventParams {
  project_id: string;
  diagram_type?: string;
  generation_duration?: number;
  sections_count?: number;
}

export interface DevelopmentEventParams {
  project_id: string;
  framework?: string;
  language?: string;
  api_type?: string;
  orm?: string;
  generation_type?: string;
}

export interface DeploymentEventParams {
  project_id: string;
  deployment_id?: string;
  mode?: string;
  cloud_provider?: string;
  deployment_duration?: number;
}

export interface FeatureUsageParams {
  feature_name: string;
  feature_category?: string;
  project_id?: string;
}

export interface ErrorEventParams {
  error_message: string;
  error_code?: string;
  page_path?: string;
  project_id?: string;
}

export interface ConversionEventParams {
  value?: number;
  currency?: string;
  transaction_id?: string;
  plan_name?: string;
}

// User properties for segmentation
export interface UserProperties {
  user_type?: 'free' | 'beta' | 'pro' | 'enterprise';
  signup_date?: string;
  projects_count?: number;
  last_active?: string;
  preferred_language?: string;
  [key: string]: string | number | undefined;
}

// Analytics configuration
export interface AnalyticsConfig {
  enabled: boolean;
  debug?: boolean;
  anonymizeIp?: boolean;
  cookieDomain?: string;
}
