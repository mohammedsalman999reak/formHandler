/**
 * Cloudflare Workers Form Handler
 * Production-ready form submission handler with Airtable and Resend integration
 * 
 * Features:
 * - CORS support for multiple domains
 * - Form validation and sanitization
 * - Airtable integration for data storage
 * - Resend email notifications
 * - Rate limiting and security
 * - Comprehensive error handling
 */

import { AirtableService } from './services/airtable.js';
import { EmailService } from './services/email.js';
import { FormValidator } from './utils/validator.js';
import { SecurityHelper } from './utils/security.js';
import { Logger } from './utils/logger.js';

// Initialize services
const airtableService = new AirtableService();
const emailService = new EmailService();
const validator = new FormValidator();
const security = new SecurityHelper();
const logger = new Logger();

/**
 * Main request handler
 * Handles all incoming requests and routes them appropriately
 */
export default {
  async fetch(request, env, ctx) {
    try {
      // Set up CORS headers for all requests
      const corsHeaders = security.getCorsHeaders(request, env.ALLOWED_ORIGINS);
      
      // Handle preflight OPTIONS requests
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: corsHeaders
        });
      }

      // Only allow POST requests for form submissions
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Method not allowed. Only POST requests are accepted.'
        }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Rate limiting check
      const rateLimitResult = await security.checkRateLimit(request, env);
      if (!rateLimitResult.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rate limit exceeded. Please try again later.'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Parse and validate the request
      const formData = await request.json();
      
      // Validate required fields
      const validationResult = validator.validateFormData(formData, env.REQUIRED_FIELDS);
      if (!validationResult.isValid) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Sanitize form data
      const sanitizedData = validator.sanitizeFormData(formData);
      
      // Add metadata
      const submissionData = {
        ...sanitizedData,
        timestamp: new Date().toISOString(),
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
        origin: request.headers.get('Origin') || 'unknown'
      };

      // Process the form submission
      const result = await processFormSubmission(submissionData, env);

      // Log the submission
      logger.log('Form submission processed', {
        success: result.success,
        submissionId: result.submissionId,
        origin: submissionData.origin
      });

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      // Log the error
      logger.error('Unexpected error in form handler', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Internal server error. Please try again later.'
      }), {
        status: 500,
        headers: security.getCorsHeaders(request, env.ALLOWED_ORIGINS)
      });
    }
  }
};

/**
 * Process form submission by saving to Airtable and sending email
 * @param {Object} formData - Sanitized form data
 * @param {Object} env - Environment variables
 * @returns {Object} Processing result
 */
async function processFormSubmission(formData, env) {
  const submissionId = generateSubmissionId();
  const results = {
    success: false,
    submissionId,
    airtable: { success: false, error: null },
    email: { success: false, error: null }
  };

  try {
    // Save to Airtable (if configured)
    if (env.AIRTABLE_API_KEY && env.AIRTABLE_BASE_ID) {
      try {
        const airtableResult = await airtableService.saveSubmission(formData, env);
        results.airtable = airtableResult;
      } catch (error) {
        results.airtable.error = error.message;
        logger.error('Airtable save failed', error);
      }
    }

    // Send email notification (if configured)
    if (env.RESEND_API_KEY) {
      try {
        const emailResult = await emailService.sendNotification(formData, env);
        results.email = emailResult;
      } catch (error) {
        results.email.error = error.message;
        logger.error('Email send failed', error);
      }
    }

    // Consider submission successful if at least one service worked
    results.success = results.airtable.success || results.email.success;

    return results;

  } catch (error) {
    logger.error('Form processing failed', error);
    throw error;
  }
}

/**
 * Generate a unique submission ID
 * @returns {string} Unique submission ID
 */
function generateSubmissionId() {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
