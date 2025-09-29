/**
 * Application Constants and Configuration
 * All hardcoded values moved here for easy management
 */

export const FILE_CONFIG = {
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    TYPE_MAPPING: {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'pdf': 'application/pdf'
    }
};

export const SECURITY_CONFIG = {
    RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
    CSRF_TOKEN_LENGTH: 32
};

export const ERROR_MESSAGES = {
    INVALID_API_KEY: 'Invalid API key',
    METHOD_NOT_ALLOWED: 'Method not allowed',
    INVALID_FILE_FORMAT: 'Invalid file data format',
    INVALID_FILE_TYPE: 'Invalid file type',
    FILE_SIZE_EXCEEDED: 'File size exceeds limit',
    INVALID_BASE64: 'Invalid base64 file data',
    INTERNAL_SERVER: 'Internal server error',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
    BOT_DETECTED: 'Automated requests are not allowed',
    INVALID_CSRF: 'Invalid CSRF token',
    INVALID_ORIGIN: 'Origin not allowed',
    CAPTCHA_REQUIRED: 'CAPTCHA verification required',
    CAPTCHA_FAILED: 'CAPTCHA verification failed'
};

export const SUCCESS_MESSAGES = {
    FORM_SUBMITTED: 'Form submitted successfully',
    EMAIL_SENT: 'Email sent successfully',
    DATA_SAVED: 'Data saved successfully'
};

export const VALIDATION_PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^[\+]?[1-9][\d]{0,15}$/,
    URL: /^https?:\/\/.+/,
    ALPHANUMERIC: /^[a-zA-Z0-9\s]+$/,
    NAME: /^[a-zA-Z\s'-]+$/
};
