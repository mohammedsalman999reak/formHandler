/**
 * Response Formatting Utilities
 */

import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../config/constants.js';

export class ResponseHelper {
    static success(data, corsHeaders = {}) {
        return new Response(JSON.stringify({
            success: true,
            ...data,
            timestamp: new Date().toISOString()
        }), {
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }

    static error(message, status = 400, additionalData = {}, corsHeaders = {}) {
        return new Response(JSON.stringify({
            success: false,
            error: message,
            ...additionalData,
            timestamp: new Date().toISOString()
        }), {
            status,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }

    static createCorsError(corsHeaders) {
        return this.error(ERROR_MESSAGES.INVALID_ORIGIN, 403, {}, corsHeaders);
    }

    static createRateLimitError(rateLimitResult, corsHeaders) {
        return this.error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED, 429, {
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        }, corsHeaders);
    }

    static createValidationError(errors, corsHeaders) {
        return this.error('Validation failed', 400, { errors }, corsHeaders);
    }

    static createSuccessResponse(submission, fileInfo, corsHeaders) {
        return this.success({
            message: SUCCESS_MESSAGES.FORM_SUBMITTED,
            submissionId: submission['Submission ID'],
            timestamp: submission['Created At'],
            file: fileInfo ? {
                filename: fileInfo.filename,
                size: fileInfo.size,
                type: fileInfo.type,
                hash: fileInfo.hash
            } : null
        }, corsHeaders);
    }
}
