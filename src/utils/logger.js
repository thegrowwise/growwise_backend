const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logger configuration
const loggerConfig = {
  level: logLevel,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // In production, use JSON format for better parsing by log aggregation services
  // In development, use pretty printing for readability
  ...(process.env.NODE_ENV === 'production' 
    ? {
        // Production: structured JSON logs for cloud log aggregation
        serializers: pino.stdSerializers,
      }
    : {
        // Development: pretty printed logs
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }
  ),
};

// Create the main logger
const logger = pino(loggerConfig);

// In production, also write to files
if (process.env.NODE_ENV === 'production') {
  // Create file streams for production logging
  const errorLogStream = pino.destination({
    dest: path.join(logsDir, 'error.log'),
    sync: false, // Asynchronous writes for better performance
  });
  
  const combinedLogStream = pino.destination({
    dest: path.join(logsDir, 'combined.log'),
    sync: false,
  });

  // Create child loggers for file output
  const errorFileLogger = pino({ level: 'error' }, errorLogStream);
  const combinedFileLogger = pino({ level: logLevel }, combinedLogStream);

  // Override logger methods to also write to files in production
  const originalError = logger.error.bind(logger);
  const originalWarn = logger.warn.bind(logger);
  const originalInfo = logger.info.bind(logger);
  const originalDebug = logger.debug.bind(logger);

  logger.error = (...args) => {
    originalError(...args);
    errorFileLogger.error(...args);
    combinedFileLogger.error(...args);
  };

  logger.warn = (...args) => {
    originalWarn(...args);
    combinedFileLogger.warn(...args);
  };

  logger.info = (...args) => {
    originalInfo(...args);
    combinedFileLogger.info(...args);
  };

  logger.debug = (...args) => {
    originalDebug(...args);
    combinedFileLogger.debug(...args);
  };
}

module.exports = logger;
