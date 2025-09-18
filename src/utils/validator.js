/**
 * Form Validator
 * Handles form data validation and sanitization
 * 
 * Features:
 * - Required field validation
 * - Email format validation
 * - XSS protection through sanitization
 * - Data type validation
 * - Length limits and constraints
 */

export class FormValidator {
  constructor() {
    // Common validation patterns
    this.patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[\+]?[1-9][\d]{0,15}$/,
      url: /^https?:\/\/.+/,
      alphanumeric: /^[a-zA-Z0-9\s]+$/,
      name: /^[a-zA-Z\s'-]+$/
    };

    // Field length limits
    this.limits = {
      name: { min: 1, max: 100 },
      email: { min: 5, max: 254 },
      phone: { min: 10, max: 20 },
      message: { min: 1, max: 5000 },
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
  validateFormData(formData, requiredFields = '') {
    const errors = [];
    const requiredFieldsList = requiredFields ? requiredFields.split(',').map(f => f.trim()) : [];

    // Check required fields
    for (const field of requiredFieldsList) {
      if (!formData[field] || formData[field].toString().trim() === '') {
        errors.push(`${field} is required`);
      }
    }

    // Validate each field
    for (const [field, value] of Object.entries(formData)) {
      const fieldErrors = this.validateField(field, value);
      errors.push(...fieldErrors);
    }

    return {
      isValid: errors.length === 0,
      errors: errors
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

    // Skip validation for empty values (handled by required field check)
    if (!stringValue) {
      return errors;
    }

    // Check length limits
    const limit = this.limits[field];
    if (limit) {
      if (stringValue.length < limit.min) {
        errors.push(`${field} must be at least ${limit.min} characters long`);
      }
      if (stringValue.length > limit.max) {
        errors.push(`${field} must be no more than ${limit.max} characters long`);
      }
    }

    // Field-specific validation
    switch (field) {
      case 'email':
        if (!this.patterns.email.test(stringValue)) {
          errors.push('Invalid email format');
        }
        break;

      case 'phone':
        if (!this.patterns.phone.test(stringValue.replace(/[\s\-\(\)]/g, ''))) {
          errors.push('Invalid phone number format');
        }
        break;

      case 'website':
        if (!this.patterns.url.test(stringValue)) {
          errors.push('Invalid website URL format');
        }
        break;

      case 'name':
        if (!this.patterns.name.test(stringValue)) {
          errors.push('Name contains invalid characters');
        }
        break;

      case 'company':
        if (stringValue.length > 0 && !this.patterns.alphanumeric.test(stringValue)) {
          errors.push('Company name contains invalid characters');
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
      // Skip system fields
      if (['timestamp', 'ip', 'userAgent', 'origin'].includes(key)) {
        sanitized[key] = value;
        continue;
      }

      // Sanitize string values
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'number') {
        sanitized[key] = this.sanitizeNumber(value);
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      } else {
        // Convert other types to string and sanitize
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
    if (typeof value !== 'string') {
      return String(value);
    }

    // HTML entity encoding map
    const htmlEntities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    const sanitizedValue = value
      .trim()
      // Encode HTML special characters to prevent XSS
      .replace(/[&<>"']/g, match => htmlEntities[match])
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters except for common whitespace (newline, tab, carriage return)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize multiple whitespace characters into a single space
      .replace(/\s+/g, ' ');

    // Limit length to prevent abuse
    return sanitizedValue.substring(0, 10000);
  }

  /**
   * Sanitize number value
   * @param {number} value - Number to sanitize
   * @returns {number} Sanitized number
   */
  sanitizeNumber(value) {
    if (typeof value !== 'number' || !isFinite(value)) {
      return 0;
    }

    // Limit to reasonable range
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
    return this.patterns.phone.test(phone.replace(/[\s\-\(\)]/g, ''));
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
      required: false // This should be determined by the form configuration
    };
  }
}
