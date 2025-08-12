const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = path.join(__dirname, '../../data/logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configure daily rotate file transport
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(logDir, '%DATE%-cruvz-api.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_MAX_FILES || '14d'
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cruvz-streaming-api' },
  transports: [
    // Write all logs with level `error` and below to `error.log`
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    // Write all logs to daily rotate file
    dailyRotateFileTransport
  ]
});

// If we're not in production, log to the console with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Six Sigma logging functions for quality tracking
logger.sixSigma = {
  defect: (category, message, data = {}) => {
    logger.error('SIX_SIGMA_DEFECT', {
      category,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  },
  
  metric: (name, value, target, category = 'general') => {
    const sigmaLevel = calculateSigmaLevel(value, target);
    logger.info('SIX_SIGMA_METRIC', {
      name,
      value,
      target,
      category,
      sigmaLevel,
      withinSpec: sigmaLevel >= 3.4,
      timestamp: new Date().toISOString()
    });
  },
  
  checkpoint: (phase, status, details = {}) => {
    logger.info('SIX_SIGMA_CHECKPOINT', {
      phase, // DEFINE, MEASURE, ANALYZE, IMPROVE, CONTROL
      status, // PASS, FAIL, WARNING
      details,
      timestamp: new Date().toISOString()
    });
  }
};

// Calculate Six Sigma level (simplified calculation)
function calculateSigmaLevel(actual, target) {
  if (target === 0) return 6; // Perfect if target is 0 and actual is 0
  const errorRate = Math.abs(actual - target) / target;
  
  if (errorRate <= 0.00034) return 6; // 6 Sigma: 3.4 DPMO
  if (errorRate <= 0.00233) return 5; // 5 Sigma: 233 DPMO
  if (errorRate <= 0.00621) return 4; // 4 Sigma: 6210 DPMO
  if (errorRate <= 0.06681) return 3; // 3 Sigma: 66810 DPMO
  if (errorRate <= 0.30854) return 2; // 2 Sigma: 308537 DPMO
  return 1; // Below 2 Sigma
}

module.exports = logger;