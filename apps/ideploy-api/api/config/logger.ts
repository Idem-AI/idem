import winston from 'winston';

const level = process.env.LOG_LEVEL || 'info';

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'ideploy-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console({ format: consoleFormat, handleExceptions: true }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', format: fileFormat }),
    new winston.transports.File({ filename: 'logs/combined.log', format: fileFormat }),
  ],
  exitOnError: false,
});

// Morgan stream
export const stream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};

export default logger;
