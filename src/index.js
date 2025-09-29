import { FILE_CONFIG, ERROR_MESSAGES } from './config/constants.js';

// Import services
import { AirtableService } from './services/airtable.js';
import { EmailService } from './services/email.js';

// Import utilities
import { FormValidator } from './utils/validator.js';
import { Logger } from './utils/logger.js';
import { FileProcessor } from './utils/file-processor.js';
import { ResponseHelper } from './utils/response-helper.js';
import { SubmissionBuilder } from './utils/submission-builder.js';

// Import middleware
import { CorsHandler } from './middleware/cors.js';
import { RateLimiter } from './middleware/rate-limiter.js';
import { AuthHandler } from './middleware/auth.js';
import { SecurityChecks } from './middleware/security-checks.js';

// Initialize handlers
const corsHandler = new CorsHandler();
const rateLimiter = new RateLimiter();
const authHandler = new AuthHandler();
const securityChecks = new SecurityChecks();
const logger = new Logger();

export default {
    async fetch(request, env, ctx) {
        // Initialize services
        const airtableService = new AirtableService();
        const emailService = new EmailService();
        const validator = new FormValidator(env);

        // Get configuration from environment
        const ALLOWED_FILE_TYPES = env.ALLOWED_FILE_TYPES ?
            env.ALLOWED_FILE_TYPES.split(',') : FILE_CONFIG.ALLOWED_TYPES;
        const MAX_FILE_SIZE = env.MAX_FILE_SIZE ?
            parseInt(env.MAX_FILE_SIZE) : FILE_CONFIG.MAX_SIZE;
        const NODE_ENV = env.NODE_ENV || 'production';

        try {
            const requestStartTime = Date.now();
            const clientIP = securityChecks.getClientIP(request);
            const corsHeaders = corsHandler.getHeaders(request, env.ALLOWED_ORIGINS);

            // Set logger level
            logger.setLogLevel(env.LOG_LEVEL || (NODE_ENV === 'development' ? 'DEBUG' : 'WARN'));

            // Log incoming request
            logger.log('Incoming request', {
                method: request.method,
                url: request.url,
                clientIP,
                userAgent: request.headers.get('User-Agent')
            });

            // Handle CORS preflight
            if (request.method === 'OPTIONS') {
                return corsHandler.handlePreflight(request, env.ALLOWED_ORIGINS);
            }

            // 1. Rate Limiting Check
            if (env.RATE_LIMITER) {
                const rateLimitResult = await rateLimiter.check(request, env);
                if (!rateLimitResult.allowed) {
                    logger.warn('Rate limit exceeded', { clientIP, rateLimitResult });
                    return ResponseHelper.createRateLimitError(rateLimitResult, corsHeaders);
                }
            }

            // 2. Bot Detection
            if (env.ENABLE_BOT_DETECTION === 'true' && securityChecks.isBotRequest(request)) {
                logger.warn('Bot request detected', { clientIP });
                return ResponseHelper.error(ERROR_MESSAGES.BOT_DETECTED, 403, {}, corsHeaders);
            }

            // 3. Request Size Validation
            const sizeValid = await securityChecks.validateRequestSize(request);
            if (!sizeValid) {
                logger.warn('Request size exceeded', { clientIP });
                return ResponseHelper.error(ERROR_MESSAGES.FILE_SIZE_EXCEEDED, 413, {}, corsHeaders);
            }

            // 4. CSRF Protection
            if (request.method !== 'GET' && env.ENABLE_CSRF_PROTECTION === 'true') {
                const securityHelper = (await import('./utils/security.js')).SecurityHelper;
                const security = new securityHelper();
                const validCsrf = security.validateCsrfToken(request);
                if (!validCsrf) {
                    logger.warn('CSRF validation failed', { clientIP });
                    return ResponseHelper.error(ERROR_MESSAGES.INVALID_CSRF, 403, {}, corsHeaders);
                }
            }

            // 5. API Key Validation
            if (!authHandler.validateApiKey(request, env.API_SECRET_KEY)) {
                logger.warn('Invalid API key', { clientIP });
                return ResponseHelper.error(ERROR_MESSAGES.INVALID_API_KEY, 401, {}, corsHeaders);
            }

            // 6. Origin Validation
            if (env.ALLOWED_ORIGINS && env.ALLOWED_ORIGINS !== '*') {
                const originValid = authHandler.validateOrigin(request, env.ALLOWED_ORIGINS);
                if (!originValid) {
                    logger.warn('Invalid origin', { clientIP, origin: request.headers.get('Origin') });
                    return ResponseHelper.createCorsError(corsHeaders);
                }
            }

            // Only POST allowed for form submissions
            if (request.method !== 'POST') {
                return ResponseHelper.error(ERROR_MESSAGES.METHOD_NOT_ALLOWED, 405, {}, corsHeaders);
            }

            // Parse request body
            let rawData;
            try {
                rawData = await request.json();
            } catch (error) {
                logger.error('JSON parse error', error);
                return ResponseHelper.error('Invalid JSON in request body', 400, {}, corsHeaders);
            }

            // 7. Turnstile CAPTCHA Validation
            if (env.TURNSTILE_SECRET_KEY) {
                const securityHelper = (await import('./utils/security.js')).SecurityHelper;
                const security = new securityHelper();
                const turnstileToken = rawData.turnstileToken || rawData.captchaToken;

                if (!turnstileToken) {
                    return ResponseHelper.error(ERROR_MESSAGES.CAPTCHA_REQUIRED, 400, {}, corsHeaders);
                }

                const validTurnstile = await security.validateTurnstileToken(turnstileToken, clientIP, env);
                if (!validTurnstile) {
                    logger.warn('Turnstile validation failed', { clientIP });
                    return ResponseHelper.error(ERROR_MESSAGES.CAPTCHA_FAILED, 400, {}, corsHeaders);
                }
            }



            // Sanitize and validate form data
            const sanitizedData = validator.sanitizeFormData(rawData);
            const formFields = SubmissionBuilder.extractFormFields(sanitizedData);

            const validation = validator.validateFormData(formFields);
            if (!validation.isValid) {
                logger.warn('Form validation failed', { errors: validation.errors, clientIP });
                return ResponseHelper.createValidationError(validation.errors, corsHeaders);
            }

            // Process file upload
            const fileInfo = await this.processFileUpload(rawData, ALLOWED_FILE_TYPES, MAX_FILE_SIZE, logger);
            if (fileInfo.error) {
                return ResponseHelper.error(fileInfo.error, 400, {}, corsHeaders);
            }

            // Prepare submission data
            const submission = SubmissionBuilder.build(formFields, fileInfo.data, request, env);

            // Execute operations in parallel
            const [airtableResult, emailResult] = await Promise.allSettled([
                airtableService.saveSubmission(submission, env),
                emailService.sendNotification({ ...submission, file: fileInfo.data }, env)
            ]);

            // Log operation results
            this.logOperationResults(airtableResult, emailResult, logger, submission['Submission ID']);

            // Log performance
            const duration = Date.now() - requestStartTime;
            logger.logPerformance('Form submission processed', duration, {
                submissionId: submission['Submission ID'],
                clientIP
            });

            // Return success response
            return ResponseHelper.createSuccessResponse(submission, fileInfo.data, corsHeaders);

        } catch (error) {
            // Global error handler
            logger.error('Unexpected error in form handler', error);
            const corsHeaders = corsHandler.getHeaders(request, env.ALLOWED_ORIGINS || '*');

            return ResponseHelper.error(
                ERROR_MESSAGES.INTERNAL_SERVER,
                500,
                NODE_ENV === 'development' ? { details: error.message } : undefined,
                corsHeaders
            );
        }
    },

    async processFileUpload(rawData, allowedTypes, maxSize, logger) {
        try {
            const { fileName, fileData } = FileProcessor.extractFileInfo(rawData);

            if (!fileName || !fileData) {
                return { data: null };
            }

            const { base64Data, fileType } = FileProcessor.processFileData(fileData, rawData.file, fileName);

            if (!FileProcessor.validateFileType(fileType, allowedTypes)) {
                return { error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` };
            }

            const binary = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const filename = FileProcessor.sanitizeFilename(fileName);
            const size = binary.length;

            if (!FileProcessor.validateFileSize(size, maxSize)) {
                return { error: `File size exceeds limit of ${maxSize / (1024 * 1024)}MB` };
            }

            const hash = await FileProcessor.computeHash(binary.buffer);

            const fileInfo = {
                filename,
                size,
                type: fileType,
                data: base64Data,
                hash,
                url: null
            };

            return { data: fileInfo };

        } catch (error) {
            logger.error('File processing error', error);
            return { error: 'Invalid file data' };
        }
    },

    logOperationResults(airtableResult, emailResult, logger, submissionId) {
        const airtableSuccess = airtableResult.status === 'fulfilled' && airtableResult.value.success;
        const emailSuccess = emailResult.status === 'fulfilled' && emailResult.value.success;

        logger.log('Form submission operations completed', {
            submissionId,
            airtable: { success: airtableSuccess },
            email: { success: emailSuccess }
        });

        // Log individual errors
        if (airtableResult.status === 'rejected') {
            logger.error('Airtable operation failed', airtableResult.reason);
        }
        if (emailResult.status === 'rejected') {
            logger.error('Email operation failed', emailResult.reason);
        }
    }
};
