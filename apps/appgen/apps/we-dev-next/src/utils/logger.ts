export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
  SUCCESS = 'SUCCESS',
}

export class ChatLogger {
  private static context: string = 'ChatAPI';

  static setContext(context: string): void {
    this.context = context;
  }

  private static formatMessage(level: LogLevel, step: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(level);
    let logMessage = `[${timestamp}] ${emoji} [${this.context}] [${level}] [${step}] ${message}`;

    if (data !== undefined) {
      logMessage += `\n${JSON.stringify(data, null, 2)}`;
    }

    return logMessage;
  }

  private static getEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.INFO:
        return 'ℹ️';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.ERROR:
        return '❌';
      case LogLevel.DEBUG:
        return '🔍';
      case LogLevel.SUCCESS:
        return '✅';
      default:
        return '📝';
    }
  }

  static info(step: string, message: string, data?: any): void {
    console.log(this.formatMessage(LogLevel.INFO, step, message, data));
  }

  static warn(step: string, message: string, data?: any): void {
    console.warn(this.formatMessage(LogLevel.WARN, step, message, data));
  }

  static error(step: string, message: string, error?: any): void {
    const errorData =
      error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(this.formatMessage(LogLevel.ERROR, step, message, errorData));
  }

  static debug(step: string, message: string, data?: any): void {
    console.log(this.formatMessage(LogLevel.DEBUG, step, message, data));
  }

  static success(step: string, message: string, data?: any): void {
    console.log(this.formatMessage(LogLevel.SUCCESS, step, message, data));
  }

  static separator(): void {
    console.log('\n' + '='.repeat(100) + '\n');
  }

  static stepStart(stepName: string): void {
    this.separator();
    this.info('STEP_START', `Starting: ${stepName}`);
    this.separator();
  }

  static stepEnd(stepName: string, duration?: number): void {
    const durationMsg = duration ? ` (${duration}ms)` : '';
    this.success('STEP_END', `Completed: ${stepName}${durationMsg}`);
    this.separator();
  }
}
