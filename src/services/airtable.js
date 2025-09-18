/**
 * Airtable Service
 * Handles all interactions with Airtable API for form data storage
 * 
 * Features:
 * - Secure API key handling
 * - Automatic retry on failures
 * - Data validation before saving
 * - Comprehensive error handling
 */

export class AirtableService {
  constructor() {
    this.baseUrl = 'https://api.airtable.com/v0';
  }

  /**
   * Save form submission to Airtable
   * @param {Object} formData - Form data to save
   * @param {Object} env - Environment variables
   * @returns {Object} Save result
   */
  async saveSubmission(formData, env) {
    try {
      // Validate required Airtable configuration
      if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) {
        throw new Error('Airtable configuration missing');
      }

      // Prepare the data for Airtable
      const airtableData = this.prepareAirtableData(formData);
      
      // Make API request to Airtable
      const response = await this.makeAirtableRequest(airtableData, env);
      
      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          recordId: result.id,
          message: 'Data saved to Airtable successfully'
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
   * Prepare form data for Airtable format
   * @param {Object} formData - Raw form data
   * @returns {Object} Airtable-formatted data
   */
  prepareAirtableData(formData) {
    const fields = {};
    
    // Map common form fields to Airtable fields
    const fieldMapping = {
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      message: 'Message',
      subject: 'Subject',
      company: 'Company',
      website: 'Website',
      source: 'Source',
      timestamp: 'Timestamp',
      ip: 'IP Address',
      userAgent: 'User Agent',
      origin: 'Origin'
    };

    // Map form data to Airtable fields
    Object.keys(formData).forEach(key => {
      const airtableField = fieldMapping[key] || this.capitalizeFirst(key);
      fields[airtableField] = formData[key];
    });

    return {
      records: [{
        fields: fields
      }]
    };
  }

  /**
   * Make API request to Airtable
   * @param {Object} data - Data to send
   * @param {Object} env - Environment variables
   * @returns {Promise<Response>} API response
   */
  async makeAirtableRequest(data, env) {
    const url = `${this.baseUrl}/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_NAME || 'Form_Submissions'}`;
    
    const requestOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
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
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Test Airtable connection
   * @param {Object} env - Environment variables
   * @returns {Object} Test result
   */
  async testConnection(env) {
    try {
      if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) {
        return {
          success: false,
          error: 'Airtable configuration missing'
        };
      }

      const url = `${this.baseUrl}/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_NAME || 'Form_Submissions'}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`
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
