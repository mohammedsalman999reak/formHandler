/**
 * Logger Utility
 * Handles logging for the form handler system
 * 
 * Features:
 * - Structured logging
 * - Different log levels
 * - Error tracking
 * - Performance monitoring
 * - Cloudflare Workers compatible
 */

export class Logger {
  constructor() {
    this.logLevel = 'INFO'; // DEBUG, INFO, WARN, ERROR
    this.startTime = Date.now();
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(message, data = {}) {
    this.writeLog('INFO', message, data);
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  debug(message, data = {}) {
    this.writeLog('DEBUG', message, data);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  warn(message, data = {}) {
    this.writeLog('WARN', message, data);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or additional data
   */
  error(message, error = {}) {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;

    this.writeLog('ERROR', message, errorData);
  }

  /**
   * Write log entry
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  writeLog(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: this.sanitizeLogData(data),
      requestId: this.generateRequestId(),
      duration: Date.now() - this.startTime
    };

    // In Cloudflare Workers, console.log is the primary logging method
    // In production, you might want to send logs to an external service
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Sanitize log data to prevent sensitive information leakage
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeLogData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    const sensitiveFields = [
      'password', 'token', 'key', 'secret', 'apiKey',
      'authorization', 'cookie', 'session'
    ];

    // Remove or mask sensitive fields
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeLogData(value);
      }
    }

    return sanitized;
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log form submission
   * @param {Object} formData - Form data
   * @param {string} status - Submission status
   * @param {Object} result - Processing result
   */
  logFormSubmission(formData, status, result) {
    this.log('Form submission processed', {
      status,
      fields: Object.keys(formData),
      result: {
        airtable: result.airtable?.success || false,
        email: result.email?.success || false,
        submissionId: result.submissionId
      },
      origin: formData.origin,
      ip: formData.ip
    });
  }

  /**
   * Log API request
   * @param {Request} request - Incoming request
   * @param {Object} response - Response object
   * @param {number} duration - Request duration in ms
   */
  logApiRequest(request, response, duration) {
    this.log('API request processed', {
      method: request.method,
      url: request.url,
      status: response.status,
      duration,
      userAgent: request.headers.get('User-Agent'),
      origin: request.headers.get('Origin'),
      ip: request.headers.get('CF-Connecting-IP')
    });
  }

  /**
   * Log service error
   * @param {string} service - Service name (airtable, email, etc.)
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  logServiceError(service, error, context = {}) {
    this.error(`Service error: ${service}`, {
      service,
      error: error.message,
      stack: error.stack,
      context
    });
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in ms
   * @param {Object} metadata - Additional metadata
   */
  logPerformance(operation, duration, metadata = {}) {
    this.log('Performance metric', {
      operation,
      duration,
      metadata
    });
  }

  /**
   * Log security event
   * @param {string} event - Security event type
   * @param {Object} details - Event details
   */
  logSecurityEvent(event, details) {
    this.warn('Security event', {
      event,
      details: this.sanitizeLogData(details),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Set log level
   * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
   */
  setLogLevel(level) {
    this.logLevel = level.toUpperCase();
  }

  /**
   * Check if log level should be written
   * @param {string} level - Log level to check
   * @returns {boolean} Should write log
   */
  shouldLog(level) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Create child logger with additional context
   * @param {Object} context - Additional context to include in all logs
   * @returns {Logger} Child logger instance
   */
  child(context) {
    const childLogger = new Logger();
    childLogger.logLevel = this.logLevel;
    childLogger.startTime = this.startTime;
    
    // Override writeLog to include context
    const originalWriteLog = childLogger.writeLog.bind(childLogger);
    childLogger.writeLog = (level, message, data) => {
      originalWriteLog(level, message, { ...context, ...data });
    };
    
    return childLogger;
  }
}
