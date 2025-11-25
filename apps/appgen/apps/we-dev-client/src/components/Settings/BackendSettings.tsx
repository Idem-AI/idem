import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectModel } from '@/api/persistence/models/project.model';
import type { DevelopmentConfigsModel } from '@/api/persistence/models/development.model';

interface BackendSettingsProps {
  project?: ProjectModel;
}

export function BackendSettings({ project }: BackendSettingsProps) {
  const { t } = useTranslation();

  if (!project?.analysisResultModel?.development?.configs) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm">
        {t('settings.backend.no_project_data')}
      </div>
    );
  }

  const developmentConfig = project.analysisResultModel.development.configs;
  const backendConfig = developmentConfig.backend;
  const databaseConfig = developmentConfig.database;
  const hasBackend = backendConfig && backendConfig.framework;
  const hasDatabase = databaseConfig && databaseConfig.provider !== 'none';

  return (
    <div className="space-y-6">
      {/* Project Information */}
      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('settings.backend.project_info')}
        </h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">{t('settings.backend.project_name')}: </span>
            <span className="text-gray-900 dark:text-gray-100">{project.name}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">{t('settings.backend.project_type')}: </span>
            <span className="text-gray-900 dark:text-gray-100">{project.type}</span>
          </div>
        </div>
      </div>

      {/* Backend Configuration */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('settings.backend.configuration')}
        </h3>
        
        <div className="mb-4">
          <label className="block text-gray-500 dark:text-gray-300 mb-1.5 text-sm">
            {t('settings.backend.enable')}
          </label>
          <div className="flex items-center">
            <div className={`w-11 h-6 rounded-full ${hasBackend ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'} relative`}>
              <div className={`absolute top-[2px] left-[2px] bg-white border border-gray-300 dark:border-gray-600 rounded-full h-5 w-5 transition-transform ${hasBackend ? 'translate-x-full' : ''}`}></div>
            </div>
            <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
              {hasBackend ? t('settings.backend.enabled') : t('settings.backend.disabled')}
            </span>
          </div>
        </div>

        {hasBackend && (
          <>
            <div className="mb-4">
              <label className="block text-gray-500 dark:text-gray-300 mb-1.5 text-sm">
                {t('settings.backend.language')}
              </label>
              <div className="flex items-center space-x-2">
                {backendConfig.languageIconUrl && (
                  <img src={backendConfig.languageIconUrl} alt={backendConfig.language} className="w-5 h-5" />
                )}
                <span className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm">
                  {backendConfig.language} {backendConfig.languageVersion && `(${backendConfig.languageVersion})`}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-500 dark:text-gray-300 mb-1.5 text-sm">
                {t('settings.backend.framework')}
              </label>
              <div className="flex items-center space-x-2">
                {backendConfig.frameworkIconUrl && (
                  <img src={backendConfig.frameworkIconUrl} alt={backendConfig.framework} className="w-5 h-5" />
                )}
                <span className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm">
                  {backendConfig.framework} {backendConfig.frameworkVersion && `(${backendConfig.frameworkVersion})`}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-500 dark:text-gray-300 mb-1.5 text-sm">
                {t('settings.backend.api_type')}
              </label>
              <div className="flex items-center space-x-2">
                {backendConfig.apiIconUrl && (
                  <img src={backendConfig.apiIconUrl} alt={backendConfig.apiType} className="w-5 h-5" />
                )}
                <span className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm">
                  {backendConfig.apiType} {backendConfig.apiVersion && `(${backendConfig.apiVersion})`}
                </span>
              </div>
            </div>

            {backendConfig.orm && (
              <div className="mb-4">
                <label className="block text-gray-500 dark:text-gray-300 mb-1.5 text-sm">
                  {t('settings.backend.orm')}
                </label>
                <div className="flex items-center space-x-2">
                  {backendConfig.ormIconUrl && (
                    <img src={backendConfig.ormIconUrl} alt={backendConfig.orm} className="w-5 h-5" />
                  )}
                  <span className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm">
                    {backendConfig.orm} {backendConfig.ormVersion && `(${backendConfig.ormVersion})`}
                  </span>
                </div>
              </div>
            )}

            {/* Backend Features */}
            <div className="mb-4">
              <label className="block text-gray-500 dark:text-gray-300 mb-1.5 text-sm">
                {t('settings.backend.features')}
              </label>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(backendConfig.features) ? (
                  backendConfig.features.map((feature, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                      {feature}
                    </span>
                  ))
                ) : (
                  Object.entries(backendConfig.features || {}).map(([key, enabled]) => 
                    enabled ? (
                      <span key={key} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                        {key}
                      </span>
                    ) : null
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Database Configuration */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('settings.backend.database.configuration')}
        </h3>
        
        <div className="mb-4">
          <label className="block text-gray-500 dark:text-gray-300 mb-1.5 text-sm">
            {t('settings.backend.database.enabled')}
          </label>
          <div className="flex items-center">
            <div className={`w-11 h-6 rounded-full ${hasDatabase ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'} relative`}>
              <div className={`absolute top-[2px] left-[2px] bg-white border border-gray-300 dark:border-gray-600 rounded-full h-5 w-5 transition-transform ${hasDatabase ? 'translate-x-full' : ''}`}></div>
            </div>
            <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
              {hasDatabase ? t('settings.backend.enabled') : t('settings.backend.disabled')}
            </span>
          </div>
        </div>

        {hasDatabase && (
          <>
            <div className="mb-4">
              <label className="block text-gray-500 dark:text-gray-300 mb-1.5 text-sm">
                {t('settings.backend.database.provider')}
              </label>
              <div className="flex items-center space-x-2">
                {databaseConfig.providerIconUrl && (
                  <img src={databaseConfig.providerIconUrl} alt={databaseConfig.provider} className="w-5 h-5" />
                )}
                <span className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm">
                  {databaseConfig.provider} {databaseConfig.version && `(${databaseConfig.version})`}
                </span>
              </div>
            </div>

            {databaseConfig.orm && (
              <div className="mb-4">
                <label className="block text-gray-500 dark:text-gray-300 mb-1.5 text-sm">
                  {t('settings.backend.database.orm')}
                </label>
                <div className="flex items-center space-x-2">
                  {databaseConfig.ormIconUrl && (
                    <img src={databaseConfig.ormIconUrl} alt={databaseConfig.orm} className="w-5 h-5" />
                  )}
                  <span className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm">
                    {databaseConfig.orm} {databaseConfig.ormVersion && `(${databaseConfig.ormVersion})`}
                  </span>
                </div>
              </div>
            )}

            {/* Database Features */}
            <div className="mb-4">
              <label className="block text-gray-500 dark:text-gray-300 mb-1.5 text-sm">
                {t('settings.backend.database.features')}
              </label>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(databaseConfig.features) ? (
                  databaseConfig.features.map((feature, index) => (
                    <span key={index} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">
                      {feature}
                    </span>
                  ))
                ) : (
                  Object.entries(databaseConfig.features || {}).map(([key, enabled]) => 
                    enabled ? (
                      <span key={key} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">
                        {key}
                      </span>
                    ) : null
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Project Configuration */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('settings.backend.project_configuration')}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(developmentConfig.projectConfig || {}).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t(`settings.backend.project_config.${key}`)}
              </span>
              <div className={`w-8 h-4 rounded-full ${value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'} relative`}>
                <div className={`absolute top-[2px] left-[2px] bg-white border border-gray-300 dark:border-gray-600 rounded-full h-3 w-3 transition-transform ${value ? 'translate-x-4' : ''}`}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Read-only Notice */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
        <div className="flex items-center">
          <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-yellow-800 dark:text-yellow-200">
            {t('settings.backend.readonly_notice')}
          </span>
        </div>
      </div>
    </div>
  );
} 