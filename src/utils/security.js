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
    // Rate limiting storage (in production, use Cloudflare KV or Durable Objects)
    this.rateLimitStore = new Map();
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
   * Check rate limit for request
   * @param {Request} request - Incoming request
   * @param {Object} env - Environment variables
   * @returns {Object} Rate limit result
   */
  async checkRateLimit(request, env) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitPerMinute = parseInt(env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 60;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    // Get or create rate limit entry for this IP
    if (!this.rateLimitStore.has(ip)) {
      this.rateLimitStore.set(ip, {
        requests: [],
        lastCleanup: now
      });
    }

    const rateLimitData = this.rateLimitStore.get(ip);
    
    // Clean up old requests outside the window
    rateLimitData.requests = rateLimitData.requests.filter(
      timestamp => now - timestamp < windowMs
    );

    // Check if rate limit exceeded
    if (rateLimitData.requests.length >= rateLimitPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: rateLimitData.requests[0] + windowMs
      };
    }

    // Add current request
    rateLimitData.requests.push(now);
    this.rateLimitStore.set(ip, rateLimitData);

    return {
      allowed: true,
      remaining: rateLimitPerMinute - rateLimitData.requests.length,
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
   * Clean up old rate limit entries
   * This should be called periodically to prevent memory leaks
   */
  cleanupRateLimitStore() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [ip, data] of this.rateLimitStore.entries()) {
      if (now - data.lastCleanup > maxAge) {
        this.rateLimitStore.delete(ip);
      }
    }
  }
}
