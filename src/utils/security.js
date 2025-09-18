/**
 * Security Helper
 * Handles security-related functionality including CORS, rate limiting, and request validation
 * 
 * Features:
 * - CORS header management
 * - Rate limiting with IP-based tracking
 * - Request origin validation
 * - Security headers
 * - Input sanitization helpers
 */

export class SecurityHelper {
  constructor() {
    // The rateLimitStore is no longer needed here, it's replaced by Cloudflare KV.
  }

  /**
   * Get CORS headers for response
   * @param {Request} request - Incoming request
   * @param {string} allowedOrigins - Comma-separated list of allowed origins
   * @returns {Object} CORS headers
   */
  getCorsHeaders(request, allowedOrigins = '*') {
    const origin = request.headers.get('Origin');
    const allowedOriginsList = allowedOrigins ? allowedOrigins.split(',').map(o => o.trim()) : ['*'];
    
    // Determine if origin is allowed
    const isAllowedOrigin = allowedOriginsList.includes('*') || 
                           allowedOriginsList.includes(origin) ||
                           this.isSubdomainAllowed(origin, allowedOriginsList);

    return {
      'Access-Control-Allow-Origin': isAllowedOrigin ? (origin || '*') : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
  }

  /**
   * Check if origin is a subdomain of allowed domains
   * @param {string} origin - Request origin
   * @param {Array} allowedOrigins - List of allowed origins
   * @returns {boolean} Is subdomain allowed
   */
  isSubdomainAllowed(origin, allowedOrigins) {
    if (!origin) return false;
    
    return allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      if (origin === allowed) return true;
      
      // Check if origin is subdomain of allowed domain
      if (allowed.startsWith('.')) {
        return origin.endsWith(allowed);
      }
      
      return false;
    });
  }

  /**
   * Check rate limit for request using Cloudflare KV
   * @param {Request} request - Incoming request
   * @param {Object} env - Environment variables, including RATE_LIMITER KV namespace
   * @returns {Object} Rate limit result
   */
  async checkRateLimit(request, env) {
    // If KV namespace is not configured, skip rate limiting
    if (!env.RATE_LIMITER) {
      console.warn('RATE_LIMITER KV namespace not found. Skipping rate limiting.');
      return { allowed: true, remaining: -1, resetTime: -1 };
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitPerMinute = parseInt(env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 60;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    // Get request timestamps from KV
    const kvData = await env.RATE_LIMITER.get(ip, { type: 'json' });
    const timestamps = kvData || [];

    // Filter timestamps to the current window
    const recentTimestamps = timestamps.filter(
      timestamp => now - timestamp < windowMs
    );

    // Check if rate limit exceeded
    if (recentTimestamps.length >= rateLimitPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: recentTimestamps[0] ? recentTimestamps[0] + windowMs : now + windowMs
      };
    }

    // Add current request timestamp and update KV
    const newTimestamps = [...recentTimestamps, now];
    await env.RATE_LIMITER.put(ip, JSON.stringify(newTimestamps), {
      expirationTtl: windowMs / 1000 // Expire the key after the window
    });

    return {
      allowed: true,
      remaining: rateLimitPerMinute - newTimestamps.length,
      resetTime: now + windowMs
    };
  }

  /**
   * Validate request origin
   * @param {Request} request - Incoming request
   * @param {string} allowedOrigins - Comma-separated list of allowed origins
   * @returns {boolean} Is origin valid
   */
  validateOrigin(request, allowedOrigins) {
    const origin = request.headers.get('Origin');
    if (!origin) return false;

    const allowedOriginsList = allowedOrigins ? allowedOrigins.split(',').map(o => o.trim()) : [];
    
    if (allowedOriginsList.includes('*')) return true;
    if (allowedOriginsList.includes(origin)) return true;
    
    return this.isSubdomainAllowed(origin, allowedOriginsList);
  }

  /**
   * Validate API key if provided
   * @param {Request} request - Incoming request
   * @param {string} expectedApiKey - Expected API key
   * @returns {boolean} Is API key valid
   */
  validateApiKey(request, expectedApiKey) {
    if (!expectedApiKey) return true; // No API key required

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return false;

    const apiKey = authHeader.replace('Bearer ', '');
    return apiKey === expectedApiKey;
  }

  /**
   * Get client IP address
   * @param {Request} request - Incoming request
   * @returns {string} Client IP address
   */
  getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For') || 
           request.headers.get('X-Real-IP') || 
           'unknown';
  }

  /**
   * Check if request is from a bot
   * @param {Request} request - Incoming request
   * @returns {boolean} Is likely bot
   */
  isBotRequest(request) {
    const userAgent = request.headers.get('User-Agent') || '';
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /java/i,
      /postman/i, /insomnia/i
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Sanitize input to prevent XSS
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return String(input);
    }

    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Generate secure random string
   * @param {number} length - Length of string
   * @returns {string} Random string
   */
  generateSecureToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Validate request size
   * @param {Request} request - Incoming request
   * @param {number} maxSize - Maximum size in bytes
   * @returns {boolean} Is size valid
   */
  async validateRequestSize(request, maxSize = 1024 * 1024) { // 1MB default
    const contentLength = request.headers.get('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return false;
    }

    // For Cloudflare Workers, we can't easily check body size before reading
    // This is a basic check - in production, consider using Durable Objects
    return true;
  }

  /**
   * Get security headers for response
   * @returns {Object} Security headers
   */
  getSecurityHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    };
  }

  /**
   * Validate Cloudflare Turnstile token
   * @param {string} token - The Turnstile token from the client
   * @param {string} ip - The client's IP address
   * @param {Object} env - Environment variables, including TURNSTILE_SECRET_KEY
   * @returns {Promise<boolean>} - True if the token is valid, false otherwise
   */
  async validateTurnstileToken(token, ip, env) {
    if (!env.TURNSTILE_SECRET_KEY) {
      console.warn('TURNSTILE_SECRET_KEY not set. Skipping Turnstile validation.');
      // Depending on security policy, you might want to fail open or closed.
      // Failing open means submissions go through without verification.
      return true;
    }

    if (!token) {
      return false;
    }

    const verificationUrl = 'https://challenges.cloudflare.com/turnstile/v2/siteverify';

    const body = new URLSearchParams();
    body.append('secret', env.TURNSTILE_SECRET_KEY);
    body.append('response', token);
    body.append('remoteip', ip);

    try {
      const response = await fetch(verificationUrl, {
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error validating Turnstile token:', error);
      return false;
    }
  }
  /**
   * Creates a Set-Cookie header string for the CSRF token.
   * @param {string} token - The CSRF token.
   * @returns {string} The Set-Cookie header string.
   */
  createCsrfCookie(token) {
    // Secure, HttpOnly cookie to prevent client-side script access.
    // SameSite=Strict provides the strongest protection against CSRF.
    return `__Host-csrf-token=${token}; Path=/; Secure; HttpOnly; SameSite=Strict`;
  }

  /**
   * Validates the CSRF token from the double-submit cookie pattern.
   * @param {Request} request - The incoming request.
   * @returns {boolean} - True if the token is valid, false otherwise.
   */
  validateCsrfToken(request) {
    const headerToken = request.headers.get('X-CSRF-Token');
    const cookieHeader = request.headers.get('Cookie');

    if (!headerToken || !cookieHeader) {
      return false;
    }

    const cookies = cookieHeader.split(';').map(c => c.trim());
    const csrfCookie = cookies.find(c => c.startsWith('__Host-csrf-token='));

    if (!csrfCookie) {
      return false;
    }

    const cookieToken = csrfCookie.split('=')[1];

    // Constant-time comparison to prevent timing attacks is ideal,
    // but for this stateless pattern, a simple string comparison is common.
    return headerToken === cookieToken;
  }
}
