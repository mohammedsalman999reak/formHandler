/**
 * Cloudflare Workers Form Handler
 * Production-ready form submission handler with Airtable and Resend integration
 * Updated to handle Airtable Timestamp field correctly
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
 */
export default {
  async fetch(request, env, ctx) {
    try {
      // Get CORS headers (allows your frontend to call this Worker)
      const corsHeaders = security.getCorsHeaders(request, env.ALLOWED_ORIGINS);

      // Handle preflight OPTIONS requests for CORS
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      const url = new URL(request.url);

      // Endpoint for issuing CSRF token
      if (request.method === 'GET' && url.pathname === '/csrf-token') {
        const csrfToken = security.generateSecureToken();
        const csrfCookie = security.createCsrfCookie(csrfToken);

        const headers = { ...corsHeaders, 'Set-Cookie': csrfCookie, 'Content-Type': 'application/json' };

        return new Response(JSON.stringify({ csrfToken }), { headers });
      }

      // Only allow POST requests for form submission
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Method not allowed. Use GET /csrf-token to get a token, or POST to submit the form.'
        }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // CSRF Protection
      if (!security.validateCsrfToken(request)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid CSRF token. Please refresh and try again.'
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Rate limiting
      const rateLimitResult = await security.checkRateLimit(request, env);
      if (!rateLimitResult.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rate limit exceeded. Please try again later.'
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Parse incoming JSON form data
      const formData = await request.json();

      // Spam protection using Cloudflare Turnstile
      const turnstileToken = formData['cf-turnstile-response'];
      const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      const isTurnstileValid = await security.validateTurnstileToken(turnstileToken, clientIp, env);

      if (!isTurnstileValid) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Spam protection validation failed. Please try again.'
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Validate required fields
      const validationResult = validator.validateFormData(formData, env.REQUIRED_FIELDS);
      if (!validationResult.isValid) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Sanitize form data to prevent bad input
      const sanitizedData = validator.sanitizeFormData(formData);

      // Prepare submission data for Airtable
      // FIX: Airtable Timestamp must be in a format it accepts
      // Here we send only ISO string with full date-time (works if field is "Date & Time")
      const now = new Date();
      const submissionData = {
        Name: sanitizedData.name || '',
        Email: sanitizedData.email || '',
        Message: sanitizedData.message || '',
        Timestamp: now.toISOString().split('T')[0],
        'IP Address': request.headers.get('CF-Connecting-IP') || 'unknown',
        Origin: request.headers.get('Origin') || request.headers.get('Referer') || 'unknown'
      };

      // Process submission: save to Airtable + send email
      const result = await processFormSubmission(submissionData, env);

      // Log submission details for debugging
      logger.log('Form submission processed', {
        success: result.success,
        submissionId: result.submissionId,
        origin: submissionData.Origin
      });

      // Return response to frontend
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      // Unexpected errors
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
 * Process form submission (Airtable + Resend Email)
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
    // Save to Airtable
    if (env.AIRTABLE_API_KEY && env.AIRTABLE_BASE_ID) {
      try {
        const airtableResult = await airtableService.saveSubmission(formData, env);
        results.airtable = airtableResult;
        console.log('Airtable response:', airtableResult);
      } catch (error) {
        results.airtable.error = error.message;
        console.error('Airtable error:', error);
      }
    }

    // Send email via Resend
    if (env.RESEND_API_KEY) {
      try {
        const emailResult = await emailService.sendNotification(formData, env);
        results.email = emailResult;
        console.log('Resend response:', emailResult);
      } catch (error) {
        results.email.error = error.message;
        console.error('Resend error:', error);
      }
    }

    // Mark overall success if at least one service succeeded
    results.success = results.airtable.success || results.email.success;
    return results;

  } catch (error) {
    console.error('Form processing failed:', error);
    throw error;
  }
}

/**
 * Generate unique submission ID
 */
function generateSubmissionId() {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
