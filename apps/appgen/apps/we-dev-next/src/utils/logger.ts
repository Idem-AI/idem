import logger from '../config/logger.js';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
  SUCCESS = 'SUCCESS',
}

/**
 * Journal des étapes de génération. L'API d'origine est conservée (76 appels),
 * mais chaque ligne part désormais dans le logger structuré : l'étape devient
 * l'événement `chat.<étape>` (ex. `chat.model_call`), les données sont des
 * champs JSON interrogeables dans Grafana, et le requestId/userId de la
 * requête suivent automatiquement.
 */
export class ChatLogger {
  private static context: string = 'ChatAPI';

  static setContext(context: string): void {
    this.context = context;
  }

  private static write(
    level: 'info' | 'warn' | 'error' | 'debug',
    step: string,
    message: string,
    data?: unknown,
    extra: Record<string, unknown> = {}
  ): void {
    const fields =
      data === undefined
        ? {}
        : data !== null && typeof data === 'object' && !Array.isArray(data) && !(data instanceof Error)
          ? (data as Record<string, unknown>)
          : { data };
    logger.log(level, message, {
      event: `chat.${step.toLowerCase()}`,
      component: this.context,
      ...fields,
      ...extra,
    });
  }

  static info(step: string, message: string, data?: any): void {
    this.write('info', step, message, data);
  }

  static warn(step: string, message: string, data?: any): void {
    this.write('warn', step, message, data);
  }

  static error(step: string, message: string, error?: any): void {
    // Une Error passée directement va dans le champ `error` (type, pile, cause).
    if (error instanceof Error) {
      this.write('error', step, message, undefined, { error });
    } else {
      this.write('error', step, message, error);
    }
  }

  static debug(step: string, message: string, data?: any): void {
    this.write('debug', step, message, data);
  }

  static success(step: string, message: string, data?: any): void {
    this.write('info', step, message, data, { outcome: 'success' });
  }

  /** Séparateur visuel de l'ancien format texte : sans objet en JSON. */
  static separator(): void {}

  static stepStart(stepName: string): void {
    this.write('info', 'STEP_START', `Starting: ${stepName}`, undefined, { stepName });
  }

  static stepEnd(stepName: string, duration?: number): void {
    this.write('info', 'STEP_END', `Completed: ${stepName}`, undefined, {
      stepName,
      durationMs: duration,
      outcome: 'success',
    });
  }
}
