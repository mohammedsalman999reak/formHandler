var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-uP6E1U/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/services/airtable.js
var AirtableService = class {
  static {
    __name(this, "AirtableService");
  }
  constructor() {
    this.baseUrl = "https://api.airtable.com/v0";
  }
  /**
   * Save form submission to Airtable
   * @param {Object} formData - Form data to save
   * @param {Object} env - Environment variables (API keys, base ID, table name)
   */
  async saveSubmission(formData, env) {
    try {
      if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) {
        throw new Error("Airtable configuration missing");
      }
      const airtableData = this.prepareAirtableData(formData);
      const response = await this.makeAirtableRequest(airtableData, env);
      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          recordId: result.id,
          // Airtable record ID
          message: "Data saved to Airtable successfully"
        };
      } else {
        const errorData = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${errorData}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  /**
   * Prepare data in format Airtable expects
   * Maps incoming form data to table fields
   */
  prepareAirtableData(formData) {
    const fields = {
      Name: formData.Name || formData.name || "",
      // Map Name
      Email: formData.Email || formData.email || "",
      // Map Email
      Message: formData.Message || formData.message || "",
      // Map Message
      Timestamp: formData.Timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      // Use ISO string for date
      "IP Address": formData["IP Address"] || formData.ip || "unknown",
      // Capture IP
      Origin: formData.Origin || formData.origin || "unknown"
      // Capture Origin header
    };
    return { records: [{ fields }] };
  }
  /**
   * Send POST request to Airtable API
   */
  async makeAirtableRequest(data, env) {
    const url = `${this.baseUrl}/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_NAME || "Form_Submissions"}`;
    const requestOptions = {
      method: "POST",
      // POST to create new record
      headers: {
        Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
        // API key in header
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
      // Convert JS object to JSON string
    };
    return await this.retryRequest(url, requestOptions, 3);
  }
  /**
   * Retry logic with exponential backoff
   * Tries the request multiple times if network/server errors occur
   */
  async retryRequest(url, options, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok || response.status >= 400 && response.status < 500) return response;
        if (attempt === maxRetries) return response;
        await this.delay(Math.pow(2, attempt) * 1e3);
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) throw error;
        await this.delay(Math.pow(2, attempt) * 1e3);
      }
    }
    throw lastError;
  }
  /**
   * Utility function to pause execution
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * Test Airtable connection
   * Useful for debugging API key or table issues
   */
  async testConnection(env) {
    try {
      if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) {
        return { success: false, error: "Airtable configuration missing" };
      }
      const url = `${this.baseUrl}/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_NAME || "Form_Submissions"}`;
      const response = await fetch(url, {
        method: "GET",
        // GET to fetch table info
        headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` }
      });
      return {
        success: response.ok,
        status: response.status,
        error: response.ok ? null : `HTTP ${response.status}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// src/services/email.js
var EmailService = class {
  static {
    __name(this, "EmailService");
  }
  constructor() {
    this.baseUrl = "https://api.resend.com";
  }
  async sendNotification(formData, env) {
    try {
      if (!env.RESEND_API_KEY) throw new Error("Resend API key not configured");
      if (!env.RESEND_FROM_EMAIL || !env.RESEND_TO_EMAIL) throw new Error("Email addresses not configured");
      const emailContent = this.prepareEmailContent(formData, env);
      const response = await this.makeResendRequest(emailContent, env);
      if (response.ok) {
        const result = await response.json();
        return { success: true, messageId: result.id, message: "Email sent successfully" };
      } else {
        const errorData = await response.json();
        throw new Error(`Resend API error: ${response.status} - ${errorData.message || "Unknown error"}`);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  prepareEmailContent(formData, env) {
    const subject = "New Form Submission";
    const htmlContent = this.generateHtmlEmail(formData);
    const textContent = this.generateTextEmail(formData);
    return {
      from: env.RESEND_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL],
      subject,
      html: htmlContent,
      text: textContent,
      reply_to: formData.Email || null
    };
  }
  generateHtmlEmail(formData) {
    const fieldsHtml = Object.entries(formData).filter(([key]) => !["Timestamp", "IP Address", "Origin"].includes(key)).map(([key, value]) => `
        <div style="margin-bottom: 10px;">
          <strong>${key}:</strong> ${this.escapeHtml(String(value))}
        </div>
      `).join("");
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2>New Form Submission</h2>
        ${fieldsHtml}
        <hr>
        <div>Timestamp: ${formData.Timestamp}</div>
        <div>IP Address: ${formData["IP Address"]}</div>
        <div>Origin: ${formData.Origin}</div>
      </div>
    `;
  }
  generateTextEmail(formData) {
    const fieldsText = Object.entries(formData).filter(([key]) => !["Timestamp", "IP Address", "Origin"].includes(key)).map(([key, value]) => `${key}: ${value}`).join("\n");
    return `
New Form Submission

${fieldsText}

---
Timestamp: ${formData.Timestamp}
IP Address: ${formData["IP Address"]}
Origin: ${formData.Origin}
    `.trim();
  }
  async makeResendRequest(emailContent, env) {
    const url = `${this.baseUrl}/emails`;
    const requestOptions = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailContent)
    };
    return await this.retryRequest(url, requestOptions, 3);
  }
  async retryRequest(url, options, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok || response.status >= 400 && response.status < 500) return response;
        if (attempt === maxRetries) return response;
        await this.delay(Math.pow(2, attempt) * 1e3);
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) throw error;
        await this.delay(Math.pow(2, attempt) * 1e3);
      }
    }
    throw lastError;
  }
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  escapeHtml(text) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
};

// src/utils/validator.js
var FormValidator = class {
  static {
    __name(this, "FormValidator");
  }
  constructor() {
    this.patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[\+]?[1-9][\d]{0,15}$/,
      url: /^https?:\/\/.+/,
      alphanumeric: /^[a-zA-Z0-9\s]+$/,
      name: /^[a-zA-Z\s'-]+$/
    };
    this.limits = {
      name: { min: 1, max: 100 },
      email: { min: 5, max: 254 },
      phone: { min: 10, max: 20 },
      message: { min: 1, max: 5e3 },
      subject: { min: 1, max: 200 },
      company: { min: 1, max: 100 },
      website: { min: 1, max: 200 }
    };
  }
  /**
   * Validate form data against required fields and rules
   * @param {Object} formData - Form data to validate
   * @param {string} requiredFields - Comma-separated list of required fields
   * @returns {Object} Validation result
   */
  validateFormData(formData, requiredFields = "") {
    const errors = [];
    const requiredFieldsList = requiredFields ? requiredFields.split(",").map((f) => f.trim()) : [];
    for (const field of requiredFieldsList) {
      if (!formData[field] || formData[field].toString().trim() === "") {
        errors.push(`${field} is required`);
      }
    }
    for (const [field, value] of Object.entries(formData)) {
      const fieldErrors = this.validateField(field, value);
      errors.push(...fieldErrors);
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  /**
   * Validate individual field
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @returns {Array} Validation errors for this field
   */
  validateField(field, value) {
    const errors = [];
    const stringValue = String(value).trim();
    if (!stringValue) {
      return errors;
    }
    const limit = this.limits[field];
    if (limit) {
      if (stringValue.length < limit.min) {
        errors.push(`${field} must be at least ${limit.min} characters long`);
      }
      if (stringValue.length > limit.max) {
        errors.push(`${field} must be no more than ${limit.max} characters long`);
      }
    }
    switch (field) {
      case "email":
        if (!this.patterns.email.test(stringValue)) {
          errors.push("Invalid email format");
        }
        break;
      case "phone":
        if (!this.patterns.phone.test(stringValue.replace(/[\s\-\(\)]/g, ""))) {
          errors.push("Invalid phone number format");
        }
        break;
      case "website":
        if (!this.patterns.url.test(stringValue)) {
          errors.push("Invalid website URL format");
        }
        break;
      case "name":
        if (!this.patterns.name.test(stringValue)) {
          errors.push("Name contains invalid characters");
        }
        break;
      case "company":
        if (stringValue.length > 0 && !this.patterns.alphanumeric.test(stringValue)) {
          errors.push("Company name contains invalid characters");
        }
        break;
    }
    return errors;
  }
  /**
   * Sanitize form data to prevent XSS and other attacks
   * @param {Object} formData - Raw form data
   * @returns {Object} Sanitized form data
   */
  sanitizeFormData(formData) {
    const sanitized = {};
    for (const [key, value] of Object.entries(formData)) {
      if (["timestamp", "ip", "userAgent", "origin"].includes(key)) {
        sanitized[key] = value;
        continue;
      }
      if (typeof value === "string") {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === "number") {
        sanitized[key] = this.sanitizeNumber(value);
      } else if (typeof value === "boolean") {
        sanitized[key] = value;
      } else {
        sanitized[key] = this.sanitizeString(String(value));
      }
    }
    return sanitized;
  }
  /**
   * Sanitize string value for storage.
   * This provides defense-in-depth against XSS by encoding HTML entities.
   * The primary defense should always be context-aware output encoding.
   * @param {string} value - String to sanitize
   * @returns {string} Sanitized string
   */
  sanitizeString(value) {
    if (typeof value !== "string") {
      return String(value);
    }
    const htmlEntities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    const sanitizedValue = value.trim().replace(/[&<>"']/g, (match) => htmlEntities[match]).replace(/\0/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\s+/g, " ");
    return sanitizedValue.substring(0, 1e4);
  }
  /**
   * Sanitize number value
   * @param {number} value - Number to sanitize
   * @returns {number} Sanitized number
   */
  sanitizeNumber(value) {
    if (typeof value !== "number" || !isFinite(value)) {
      return 0;
    }
    return Math.max(-999999999, Math.min(999999999, value));
  }
  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Is valid email
   */
  isValidEmail(email) {
    return this.patterns.email.test(email);
  }
  /**
   * Validate phone number format
   * @param {string} phone - Phone to validate
   * @returns {boolean} Is valid phone
   */
  isValidPhone(phone) {
    return this.patterns.phone.test(phone.replace(/[\s\-\(\)]/g, ""));
  }
  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} Is valid URL
   */
  isValidUrl(url) {
    return this.patterns.url.test(url);
  }
  /**
   * Check if string contains only safe characters
   * @param {string} str - String to check
   * @returns {boolean} Is safe string
   */
  isSafeString(str) {
    return this.patterns.alphanumeric.test(str);
  }
  /**
   * Get field validation rules
   * @param {string} field - Field name
   * @returns {Object} Validation rules
   */
  getFieldRules(field) {
    return {
      pattern: this.patterns[field] || null,
      limits: this.limits[field] || null,
      required: false
      // This should be determined by the form configuration
    };
  }
};

// src/utils/security.js
var SecurityHelper = class {
  static {
    __name(this, "SecurityHelper");
  }
  constructor() {
  }
  /**
   * Get CORS headers for response
   * @param {Request} request - Incoming request
   * @param {string} allowedOrigins - Comma-separated list of allowed origins
   * @returns {Object} CORS headers
   */
  getCorsHeaders(request, allowedOrigins = "*") {
    const origin = request.headers.get("Origin");
    const allowedOriginsList = allowedOrigins ? allowedOrigins.split(",").map((o) => o.trim()) : ["*"];
    const isAllowedOrigin = allowedOriginsList.includes("*") || allowedOriginsList.includes(origin) || this.isSubdomainAllowed(origin, allowedOriginsList);
    return {
      "Access-Control-Allow-Origin": isAllowedOrigin ? origin || "*" : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin"
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
    return allowedOrigins.some((allowed) => {
      if (allowed === "*") return true;
      if (origin === allowed) return true;
      if (allowed.startsWith(".")) {
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
    if (!env.RATE_LIMITER) {
      console.warn("RATE_LIMITER KV namespace not found. Skipping rate limiting.");
      return { allowed: true, remaining: -1, resetTime: -1 };
    }
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateLimitPerMinute = parseInt(env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 60;
    const now = Date.now();
    const windowMs = 60 * 1e3;
    const kvData = await env.RATE_LIMITER.get(ip, { type: "json" });
    const timestamps = kvData || [];
    const recentTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < windowMs
    );
    if (recentTimestamps.length >= rateLimitPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: recentTimestamps[0] ? recentTimestamps[0] + windowMs : now + windowMs
      };
    }
    const newTimestamps = [...recentTimestamps, now];
    await env.RATE_LIMITER.put(ip, JSON.stringify(newTimestamps), {
      expirationTtl: windowMs / 1e3
      // Expire the key after the window
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
    const origin = request.headers.get("Origin");
    if (!origin) return false;
    const allowedOriginsList = allowedOrigins ? allowedOrigins.split(",").map((o) => o.trim()) : [];
    if (allowedOriginsList.includes("*")) return true;
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
    if (!expectedApiKey) return true;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return false;
    const apiKey = authHeader.replace("Bearer ", "");
    return apiKey === expectedApiKey;
  }
  /**
   * Get client IP address
   * @param {Request} request - Incoming request
   * @returns {string} Client IP address
   */
  getClientIP(request) {
    return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || request.headers.get("X-Real-IP") || "unknown";
  }
  /**
   * Check if request is from a bot
   * @param {Request} request - Incoming request
   * @returns {boolean} Is likely bot
   */
  isBotRequest(request) {
    const userAgent = request.headers.get("User-Agent") || "";
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /postman/i,
      /insomnia/i
    ];
    return botPatterns.some((pattern) => pattern.test(userAgent));
  }
  /**
   * Sanitize input to prevent XSS
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (typeof input !== "string") {
      return String(input);
    }
    return input.replace(/[<>]/g, "").replace(/javascript:/gi, "").replace(/on\w+=/gi, "").trim();
  }
  /**
   * Generate secure random string
   * @param {number} length - Length of string
   * @returns {string} Random string
   */
  generateSecureToken(length = 32) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
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
  async validateRequestSize(request, maxSize = 1024 * 1024) {
    const contentLength = request.headers.get("Content-Length");
    if (contentLength && parseInt(contentLength) > maxSize) {
      return false;
    }
    return true;
  }
  /**
   * Get security headers for response
   * @returns {Object} Security headers
   */
  getSecurityHeaders() {
    return {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
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
      console.warn("TURNSTILE_SECRET_KEY not set. Skipping Turnstile validation.");
      return true;
    }
    if (!token) {
      return false;
    }
    const verificationUrl = "https://challenges.cloudflare.com/turnstile/v2/siteverify";
    const body = new URLSearchParams();
    body.append("secret", env.TURNSTILE_SECRET_KEY);
    body.append("response", token);
    body.append("remoteip", ip);
    try {
      const response = await fetch(verificationUrl, {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error("Error validating Turnstile token:", error);
      return false;
    }
  }
  /**
   * Creates a Set-Cookie header string for the CSRF token.
   * @param {string} token - The CSRF token.
   * @returns {string} The Set-Cookie header string.
   */
  createCsrfCookie(token) {
    return `__Host-csrf-token=${token}; Path=/; Secure; HttpOnly; SameSite=Strict`;
  }
  /**
   * Validates the CSRF token from the double-submit cookie pattern.
   * @param {Request} request - The incoming request.
   * @returns {boolean} - True if the token is valid, false otherwise.
   */
  validateCsrfToken(request) {
    const headerToken = request.headers.get("X-CSRF-Token");
    const cookieHeader = request.headers.get("Cookie");
    if (!headerToken || !cookieHeader) {
      return false;
    }
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const csrfCookie = cookies.find((c) => c.startsWith("__Host-csrf-token="));
    if (!csrfCookie) {
      return false;
    }
    const cookieToken = csrfCookie.split("=")[1];
    return headerToken === cookieToken;
  }
};

// src/utils/logger.js
var Logger = class _Logger {
  static {
    __name(this, "Logger");
  }
  constructor() {
    this.logLevel = "INFO";
    this.startTime = Date.now();
  }
  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(message, data = {}) {
    this.writeLog("INFO", message, data);
  }
  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  debug(message, data = {}) {
    this.writeLog("DEBUG", message, data);
  }
  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  warn(message, data = {}) {
    this.writeLog("WARN", message, data);
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
    this.writeLog("ERROR", message, errorData);
  }
  /**
   * Write log entry
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  writeLog(level, message, data) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: this.sanitizeLogData(data),
      requestId: this.generateRequestId(),
      duration: Date.now() - this.startTime
    };
    console.log(JSON.stringify(logEntry));
  }
  /**
   * Sanitize log data to prevent sensitive information leakage
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeLogData(data) {
    if (!data || typeof data !== "object") {
      return data;
    }
    const sanitized = { ...data };
    const sensitiveFields = [
      "password",
      "token",
      "key",
      "secret",
      "apiKey",
      "authorization",
      "cookie",
      "session"
    ];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === "object" && value !== null) {
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
    this.log("Form submission processed", {
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
    this.log("API request processed", {
      method: request.method,
      url: request.url,
      status: response.status,
      duration,
      userAgent: request.headers.get("User-Agent"),
      origin: request.headers.get("Origin"),
      ip: request.headers.get("CF-Connecting-IP")
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
    this.log("Performance metric", {
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
    this.warn("Security event", {
      event,
      details: this.sanitizeLogData(details),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
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
    const levels = ["DEBUG", "INFO", "WARN", "ERROR"];
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
    const childLogger = new _Logger();
    childLogger.logLevel = this.logLevel;
    childLogger.startTime = this.startTime;
    const originalWriteLog = childLogger.writeLog.bind(childLogger);
    childLogger.writeLog = (level, message, data) => {
      originalWriteLog(level, message, { ...context, ...data });
    };
    return childLogger;
  }
};

// src/index.js
var airtableService = new AirtableService();
var emailService = new EmailService();
var validator = new FormValidator();
var security = new SecurityHelper();
var logger = new Logger();
var src_default = {
  async fetch(request, env, ctx) {
    try {
      const corsHeaders = security.getCorsHeaders(request, env.ALLOWED_ORIGINS);
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
      }
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/csrf-token") {
        const csrfToken = security.generateSecureToken();
        const csrfCookie = security.createCsrfCookie(csrfToken);
        const headers = { ...corsHeaders, "Set-Cookie": csrfCookie, "Content-Type": "application/json" };
        return new Response(JSON.stringify({ csrfToken }), { headers });
      }
      if (request.method !== "POST") {
        return new Response(JSON.stringify({
          success: false,
          error: "Method not allowed. Use GET /csrf-token to get a token, or POST to submit the form."
        }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!security.validateCsrfToken(request)) {
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid CSRF token. Please refresh and try again."
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const rateLimitResult = await security.checkRateLimit(request, env);
      if (!rateLimitResult.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: "Rate limit exceeded. Please try again later."
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const formData = await request.json();
      const turnstileToken = formData["cf-turnstile-response"];
      const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
      const isTurnstileValid = await security.validateTurnstileToken(turnstileToken, clientIp, env);
      if (!isTurnstileValid) {
        return new Response(JSON.stringify({
          success: false,
          error: "Spam protection validation failed. Please try again."
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const validationResult = validator.validateFormData(formData, env.REQUIRED_FIELDS);
      if (!validationResult.isValid) {
        return new Response(JSON.stringify({
          success: false,
          error: "Validation failed",
          details: validationResult.errors
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sanitizedData = validator.sanitizeFormData(formData);
      const now = /* @__PURE__ */ new Date();
      const submissionData = {
        Name: sanitizedData.name || "",
        Email: sanitizedData.email || "",
        Message: sanitizedData.message || "",
        Timestamp: now.toISOString().split("T")[0],
        "IP Address": request.headers.get("CF-Connecting-IP") || "unknown",
        Origin: request.headers.get("Origin") || request.headers.get("Referer") || "unknown"
      };
      const result = await processFormSubmission(submissionData, env);
      logger.log("Form submission processed", {
        success: result.success,
        submissionId: result.submissionId,
        origin: submissionData.Origin
      });
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (error) {
      logger.error("Unexpected error in form handler", error);
      return new Response(JSON.stringify({
        success: false,
        error: "Internal server error. Please try again later."
      }), {
        status: 500,
        headers: security.getCorsHeaders(request, env.ALLOWED_ORIGINS)
      });
    }
  }
};
async function processFormSubmission(formData, env) {
  const submissionId = generateSubmissionId();
  const results = {
    success: false,
    submissionId,
    airtable: { success: false, error: null },
    email: { success: false, error: null }
  };
  try {
    if (env.AIRTABLE_API_KEY && env.AIRTABLE_BASE_ID) {
      try {
        const airtableResult = await airtableService.saveSubmission(formData, env);
        results.airtable = airtableResult;
        console.log("Airtable response:", airtableResult);
      } catch (error) {
        results.airtable.error = error.message;
        console.error("Airtable error:", error);
      }
    }
    if (env.RESEND_API_KEY) {
      try {
        const emailResult = await emailService.sendNotification(formData, env);
        results.email = emailResult;
        console.log("Resend response:", emailResult);
      } catch (error) {
        results.email.error = error.message;
        console.error("Resend error:", error);
      }
    }
    results.success = results.airtable.success || results.email.success;
    return results;
  } catch (error) {
    console.error("Form processing failed:", error);
    throw error;
  }
}
__name(processFormSubmission, "processFormSubmission");
function generateSubmissionId() {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
__name(generateSubmissionId, "generateSubmissionId");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-uP6E1U/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-uP6E1U/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
