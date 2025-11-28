const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Detect if we're in a serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_TARGET;

// Create logs directory if it doesn't exist (only in non-serverless environments)
let logsDir = null;
if (!isServerless) {
  logsDir = path.join(__dirname, '../../logs');
  if (!fs.existsSync(logsDir)) {
    try {
      fs.mkdirSync(logsDir, { recursive: true });
    } catch (error) {
      // Ignore errors if directory creation fails (e.g., read-only filesystem)
      console.warn('Failed to create logs directory:', error.message);
    }
  }
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

// In production, also write to files (only if not in serverless environment)
if (process.env.NODE_ENV === 'production' && !isServerless && logsDir) {
  try {
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
  } catch (error) {
    // If file logging fails (e.g., in serverless), just use console logging
    console.warn('File logging not available:', error.message);
  }
}

module.exports = logger;
