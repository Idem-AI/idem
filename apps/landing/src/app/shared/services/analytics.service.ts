import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Analytics, logEvent, setUserId, setUserProperties } from '@angular/fire/analytics';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AnalyticsEvent,
  PageViewParams,
  ProjectEventParams,
  BrandingEventParams,
  BusinessPlanEventParams,
  DiagramEventParams,
  DevelopmentEventParams,
  DeploymentEventParams,
  FeatureUsageParams,
  ErrorEventParams,
  ConversionEventParams,
  UserProperties,
} from '../models/analytics.model';

/**
 * Analytics Service
 * Centralizes all Firebase Analytics tracking
 * Only active in production environment
 */
@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private analytics: Analytics;
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly isEnabled = environment.analytics?.enabled ?? false;

  constructor() {
    // Inject Analytics (Angular will handle SSR automatically)
    this.analytics = inject(Analytics);

    // Only track in browser and when enabled (production)
    if (this.isBrowser && this.isEnabled && this.analytics) {
      this.initializePageTracking();
    }
  }

  /**
   * Initialize automatic page tracking
   */
  private initializePageTracking(): void {
    // Track initial page load (when user arrives directly on a page)
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.trackPageView({
          page_title: document.title,
          page_location: window.location.href,
          page_path: window.location.pathname,
        });
      }, 100);
    }

    // Track all subsequent navigations
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.trackPageView({
          page_title: document.title,
          page_location: window.location.href,
          page_path: event.urlAfterRedirects,
        });
      });
  }

  /**
   * Check if analytics is enabled
   */
  private canTrack(): boolean {
    return this.isBrowser && this.isEnabled && !!this.analytics;
  }

  /**
   * Track page view
   */
  trackPageView(params: PageViewParams): void {
    if (!this.canTrack()) return;

    logEvent(this.analytics!, AnalyticsEvent.PAGE_VIEW, {
      page_title: params.page_title,
      page_location: params.page_location,
      page_path: params.page_path,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Set user ID for tracking
   */
  setUser(userId: string): void {
    if (!this.canTrack() || !this.analytics) return;
    setUserId(this.analytics!, userId);
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.canTrack() || !this.analytics) return;
    setUserProperties(this.analytics!, properties);
  }

  // ============================================
  // AUTHENTICATION EVENTS
  // ============================================

  trackLogin(method: string): void {
    this.trackEvent(AnalyticsEvent.LOGIN, { method });
  }

  trackSignUp(method: string): void {
    this.trackEvent(AnalyticsEvent.SIGN_UP, { method });
  }

  trackLogout(): void {
    this.trackEvent(AnalyticsEvent.LOGOUT, {});
  }

  // ============================================
  // PROJECT EVENTS
  // ============================================

  trackProjectCreated(params: ProjectEventParams): void {
    this.trackEvent(AnalyticsEvent.PROJECT_CREATED, {
      project_id: params.project_id,
      project_name: params.project_name,
      project_type: params.project_type,
      timestamp: new Date().toISOString(),
    });
  }

  trackProjectViewed(params: ProjectEventParams): void {
    this.trackEvent(AnalyticsEvent.PROJECT_VIEWED, {
      project_id: params.project_id,
    });
  }

  trackProjectUpdated(params: ProjectEventParams): void {
    this.trackEvent(AnalyticsEvent.PROJECT_UPDATED, {
      project_id: params.project_id,
    });
  }

  trackProjectDeleted(params: ProjectEventParams): void {
    this.trackEvent(AnalyticsEvent.PROJECT_DELETED, {
      project_id: params.project_id,
    });
  }

  // ============================================
  // BRANDING EVENTS
  // ============================================

  trackBrandingStarted(params: BrandingEventParams): void {
    this.trackEvent(AnalyticsEvent.BRANDING_STARTED, {
      project_id: params.project_id,
      timestamp: new Date().toISOString(),
    });
  }

  trackBrandingCompleted(params: BrandingEventParams): void {
    this.trackEvent(AnalyticsEvent.BRANDING_COMPLETED, {
      project_id: params.project_id,
      generation_duration: params.generation_duration,
      logo_count: params.logo_count,
    });
  }

  trackLogoGenerated(params: BrandingEventParams): void {
    this.trackEvent(AnalyticsEvent.LOGO_GENERATED, {
      project_id: params.project_id,
      logo_count: params.logo_count,
    });
  }

  trackLogoSelected(params: BrandingEventParams): void {
    this.trackEvent(AnalyticsEvent.LOGO_SELECTED, {
      project_id: params.project_id,
    });
  }

  trackColorSelected(params: BrandingEventParams): void {
    this.trackEvent(AnalyticsEvent.COLOR_SELECTED, {
      project_id: params.project_id,
      selected_color: params.selected_color,
    });
  }

  trackTypographySelected(params: BrandingEventParams): void {
    this.trackEvent(AnalyticsEvent.TYPOGRAPHY_SELECTED, {
      project_id: params.project_id,
      selected_typography: params.selected_typography,
    });
  }

  // ============================================
  // BUSINESS PLAN EVENTS
  // ============================================

  trackBusinessPlanStarted(params: BusinessPlanEventParams): void {
    this.trackEvent(AnalyticsEvent.BUSINESS_PLAN_STARTED, {
      project_id: params.project_id,
      timestamp: new Date().toISOString(),
    });
  }

  trackBusinessPlanCompleted(params: BusinessPlanEventParams): void {
    this.trackEvent(AnalyticsEvent.BUSINESS_PLAN_COMPLETED, {
      project_id: params.project_id,
      generation_duration: params.generation_duration,
      sections_count: params.sections_count,
    });
  }

  trackBusinessPlanExported(params: BusinessPlanEventParams): void {
    this.trackEvent(AnalyticsEvent.BUSINESS_PLAN_EXPORTED, {
      project_id: params.project_id,
      export_format: params.export_format,
    });
  }

  // ============================================
  // DIAGRAM EVENTS
  // ============================================

  trackDiagramStarted(params: DiagramEventParams): void {
    this.trackEvent(AnalyticsEvent.DIAGRAM_STARTED, {
      project_id: params.project_id,
      diagram_type: params.diagram_type,
      timestamp: new Date().toISOString(),
    });
  }

  trackDiagramCompleted(params: DiagramEventParams): void {
    this.trackEvent(AnalyticsEvent.DIAGRAM_COMPLETED, {
      project_id: params.project_id,
      diagram_type: params.diagram_type,
      generation_duration: params.generation_duration,
      sections_count: params.sections_count,
    });
  }

  trackDiagramTypeSelected(params: DiagramEventParams): void {
    this.trackEvent(AnalyticsEvent.DIAGRAM_TYPE_SELECTED, {
      project_id: params.project_id,
      diagram_type: params.diagram_type,
    });
  }

  // ============================================
  // DEVELOPMENT EVENTS
  // ============================================

  trackDevelopmentConfigStarted(params: DevelopmentEventParams): void {
    this.trackEvent(AnalyticsEvent.DEVELOPMENT_CONFIG_STARTED, {
      project_id: params.project_id,
      timestamp: new Date().toISOString(),
    });
  }

  trackDevelopmentConfigCompleted(params: DevelopmentEventParams): void {
    this.trackEvent(AnalyticsEvent.DEVELOPMENT_CONFIG_COMPLETED, {
      project_id: params.project_id,
      framework: params.framework,
      language: params.language,
      api_type: params.api_type,
      orm: params.orm,
      generation_type: params.generation_type,
    });
  }

  trackFrameworkSelected(params: DevelopmentEventParams): void {
    this.trackEvent(AnalyticsEvent.FRAMEWORK_SELECTED, {
      project_id: params.project_id,
      framework: params.framework,
    });
  }

  trackLanguageSelected(params: DevelopmentEventParams): void {
    this.trackEvent(AnalyticsEvent.LANGUAGE_SELECTED, {
      project_id: params.project_id,
      language: params.language,
    });
  }

  // ============================================
  // DEPLOYMENT EVENTS
  // ============================================

  trackDeploymentStarted(params: DeploymentEventParams): void {
    this.trackEvent(AnalyticsEvent.DEPLOYMENT_STARTED, {
      project_id: params.project_id,
      deployment_id: params.deployment_id,
      mode: params.mode,
      cloud_provider: params.cloud_provider,
      timestamp: new Date().toISOString(),
    });
  }

  trackDeploymentCompleted(params: DeploymentEventParams): void {
    this.trackEvent(AnalyticsEvent.DEPLOYMENT_COMPLETED, {
      project_id: params.project_id,
      deployment_id: params.deployment_id,
      deployment_duration: params.deployment_duration,
    });
  }

  trackDeploymentModeSelected(params: DeploymentEventParams): void {
    this.trackEvent(AnalyticsEvent.DEPLOYMENT_MODE_SELECTED, {
      project_id: params.project_id,
      mode: params.mode,
    });
  }

  trackCloudProviderSelected(params: DeploymentEventParams): void {
    this.trackEvent(AnalyticsEvent.CLOUD_PROVIDER_SELECTED, {
      project_id: params.project_id,
      cloud_provider: params.cloud_provider,
    });
  }

  // ============================================
  // CONVERSION EVENTS
  // ============================================

  trackTrialStarted(params: ConversionEventParams): void {
    this.trackEvent(AnalyticsEvent.TRIAL_STARTED, {
      plan_name: params.plan_name,
      timestamp: new Date().toISOString(),
    });
  }

  trackPurchase(params: ConversionEventParams): void {
    this.trackEvent(AnalyticsEvent.PURCHASE, {
      value: params.value,
      currency: params.currency || 'USD',
      transaction_id: params.transaction_id,
      plan_name: params.plan_name,
    });
  }

  trackSubscriptionStarted(params: ConversionEventParams): void {
    this.trackEvent(AnalyticsEvent.SUBSCRIPTION_STARTED, {
      value: params.value,
      currency: params.currency || 'USD',
      plan_name: params.plan_name,
    });
  }

  trackSubscriptionCancelled(params: ConversionEventParams): void {
    this.trackEvent(AnalyticsEvent.SUBSCRIPTION_CANCELLED, {
      plan_name: params.plan_name,
    });
  }

  // ============================================
  // FEATURE USAGE
  // ============================================

  trackFeatureUsed(params: FeatureUsageParams): void {
    this.trackEvent(AnalyticsEvent.FEATURE_USED, {
      feature_name: params.feature_name,
      feature_category: params.feature_category,
      project_id: params.project_id,
    });
  }

  trackExportPDF(projectId: string): void {
    this.trackEvent(AnalyticsEvent.EXPORT_PDF, {
      project_id: projectId,
    });
  }

  trackExportJSON(projectId: string): void {
    this.trackEvent(AnalyticsEvent.EXPORT_JSON, {
      project_id: projectId,
    });
  }

  // ============================================
  // ERROR TRACKING
  // ============================================

  trackError(params: ErrorEventParams): void {
    this.trackEvent(AnalyticsEvent.ERROR_OCCURRED, {
      error_message: params.error_message,
      error_code: params.error_code,
      page_path: params.page_path || this.router.url,
      project_id: params.project_id,
      timestamp: new Date().toISOString(),
    });
  }

  trackGenerationFailed(params: ErrorEventParams): void {
    this.trackEvent(AnalyticsEvent.GENERATION_FAILED, {
      error_message: params.error_message,
      project_id: params.project_id,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================
  // GENERIC EVENT TRACKING
  // ============================================

  /**
   * Generic event tracking method
   */
  private trackEvent(eventName: string, params: Record<string, unknown>): void {
    if (!this.canTrack() || !this.analytics) return;

    logEvent(this.analytics!, eventName, params);
  }

  /**
   * Track custom event with any parameters
   */
  trackCustomEvent(eventName: string, params?: Record<string, unknown>): void {
    this.trackEvent(eventName, params || {});
  }
}
