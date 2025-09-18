/**
 * Email Service (Resend Integration)
 * Handles email notifications for form submissions
 * 
 * Features:
 * - Resend API integration
 * - HTML and text email templates
 * - Automatic retry on failures
 * - Email validation and sanitization
 * - Comprehensive error handling
 */

export class EmailService {
  constructor() {
    this.baseUrl = 'https://api.resend.com';
  }

  /**
   * Send form submission notification email
   * @param {Object} formData - Form data to include in email
   * @param {Object} env - Environment variables
   * @returns {Object} Send result
   */
  async sendNotification(formData, env) {
    try {
      // Validate required email configuration
      if (!env.RESEND_API_KEY) {
        throw new Error('Resend API key not configured');
      }

      if (!env.RESEND_FROM_EMAIL || !env.RESEND_TO_EMAIL) {
        throw new Error('Email addresses not configured');
      }

      // Prepare email content
      const emailContent = this.prepareEmailContent(formData);
      
      // Make API request to Resend
      const response = await this.makeResendRequest(emailContent, env);
      
      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          messageId: result.id,
          message: 'Email sent successfully'
        };
      } else {
        const errorData = await response.json();
        throw new Error(`Resend API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Prepare email content for Resend API
   * @param {Object} formData - Form data
   * @returns {Object} Email content
   */
  prepareEmailContent(formData) {
    const subject = formData.subject || 'New Form Submission';
    const htmlContent = this.generateHtmlEmail(formData);
    const textContent = this.generateTextEmail(formData);

    return {
      from: this.getFromEmail(formData),
      to: [this.getToEmail(formData)],
      subject: subject,
      html: htmlContent,
      text: textContent,
      reply_to: formData.email || null
    };
  }

  /**
   * Generate HTML email content
   * @param {Object} formData - Form data
   * @returns {string} HTML content
   */
  generateHtmlEmail(formData) {
    const fields = this.formatFormFields(formData);
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Form Submission</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #555; }
            .value { margin-top: 5px; padding: 10px; background: #f9f9f9; border-radius: 3px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Form Submission</h2>
              <p>You have received a new form submission.</p>
            </div>
            
            <div class="content">
              ${fields}
            </div>
            
            <div class="footer">
              <p>This email was sent from your form handler system.</p>
              <p>Timestamp: ${formData.timestamp}</p>
              <p>IP Address: ${formData.ip}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate text email content
   * @param {Object} formData - Form data
   * @returns {string} Text content
   */
  generateTextEmail(formData) {
    const fields = Object.entries(formData)
      .filter(([key, value]) => !['timestamp', 'ip', 'userAgent', 'origin'].includes(key))
      .map(([key, value]) => `${this.capitalizeFirst(key)}: ${value}`)
      .join('\n');

    return `
New Form Submission

${fields}

---
Timestamp: ${formData.timestamp}
IP Address: ${formData.ip}
    `.trim();
  }

  /**
   * Format form fields for HTML display
   * @param {Object} formData - Form data
   * @returns {string} HTML formatted fields
   */
  formatFormFields(formData) {
    const excludeFields = ['timestamp', 'ip', 'userAgent', 'origin'];
    
    return Object.entries(formData)
      .filter(([key, value]) => !excludeFields.includes(key))
      .map(([key, value]) => `
        <div class="field">
          <div class="label">${this.capitalizeFirst(key)}</div>
          <div class="value">${this.escapeHtml(String(value))}</div>
        </div>
      `).join('');
  }

  /**
   * Get from email address
   * @param {Object} formData - Form data
   * @returns {string} From email
   */
  getFromEmail(formData) {
    // Use configured from email or form email if available
    return formData.email || process.env.RESEND_FROM_EMAIL;
  }

  /**
   * Get to email address
   * @param {Object} formData - Form data
   * @returns {string} To email
   */
  getToEmail(formData) {
    // Use configured to email
    return process.env.RESEND_TO_EMAIL;
  }

  /**
   * Make API request to Resend
   * @param {Object} emailContent - Email content
   * @param {Object} env - Environment variables
   * @returns {Promise<Response>} API response
   */
  async makeResendRequest(emailContent, env) {
    const url = `${this.baseUrl}/emails`;
    
    const requestOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailContent)
    };

    // Add retry logic for network failures
    return await this.retryRequest(url, requestOptions, 3);
  }

  /**
   * Retry request with exponential backoff
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<Response>} API response
   */
  async retryRequest(url, options, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // If successful or client error (4xx), don't retry
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response;
        }
        
        // For server errors (5xx), retry
        if (attempt === maxRetries) {
          return response;
        }
        
        // Wait before retry (exponential backoff)
        await this.delay(Math.pow(2, attempt) * 1000);
        
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    throw lastError;
  }

  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Test Resend connection
   * @param {Object} env - Environment variables
   * @returns {Object} Test result
   */
  async testConnection(env) {
    try {
      if (!env.RESEND_API_KEY) {
        return {
          success: false,
          error: 'Resend API key not configured'
        };
      }

      const url = `${this.baseUrl}/domains`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`
        }
      });

      return {
        success: response.ok,
        status: response.status,
        error: response.ok ? null : `HTTP ${response.status}`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
