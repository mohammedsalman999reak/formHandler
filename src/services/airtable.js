/**
 * AirtableService
 * Handles all interactions with Airtable API for form submissions
 */
export class AirtableService {
  constructor() {
    // Base URL for Airtable API
    this.baseUrl = 'https://api.airtable.com/v0';
  }

  /**
   * Save form submission to Airtable
   * @param {Object} formData - Form data to save
   * @param {Object} env - Environment variables (API keys, base ID, table name)
   */
  async saveSubmission(formData, env) {
    try {
      // Ensure Airtable configuration exists
      if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) {
        throw new Error('Airtable configuration missing');
      }

      // Prepare data in Airtable format
      const airtableData = this.prepareAirtableData(formData);

      // Send data to Airtable
      const response = await this.makeAirtableRequest(airtableData, env);

      // If request successful, return success object
      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          recordId: result.id, // Airtable record ID
          message: 'Data saved to Airtable successfully'
        };
      } else {
        // If API returns error, capture it
        const errorData = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${errorData}`);
      }
    } catch (error) {
      // Return error object instead of throwing
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
    // Only map fields that exist in your Airtable table
    const fields = {
      Name: formData.Name || formData.name || '',          // Map Name
      Email: formData.Email || formData.email || '',       // Map Email
      Message: formData.Message || formData.message || '', // Map Message
      Timestamp: formData.Timestamp || new Date().toISOString(), // Use ISO string for date
      'IP Address': formData['IP Address'] || formData.ip || 'unknown', // Capture IP
      Origin: formData.Origin || formData.origin || 'unknown'          // Capture Origin header
    };

    // Airtable API expects records array
    return { records: [{ fields }] };
  }

  /**
   * Send POST request to Airtable API
   */
  async makeAirtableRequest(data, env) {
    const url = `${this.baseUrl}/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_NAME || 'Form_Submissions'}`;

    const requestOptions = {
      method: 'POST',  // POST to create new record
      headers: {
        Authorization: `Bearer ${env.AIRTABLE_API_KEY}`, // API key in header
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data) // Convert JS object to JSON string
    };

    // Retry request in case of failures
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

        // If success or client error, return immediately
        if (response.ok || (response.status >= 400 && response.status < 500)) return response;

        // If server error and last attempt, return response
        if (attempt === maxRetries) return response;

        // Wait before retrying (exponential backoff)
        await this.delay(Math.pow(2, attempt) * 1000);
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) throw error; // Throw if final attempt
        await this.delay(Math.pow(2, attempt) * 1000); // Wait before next try
      }
    }
    throw lastError;
  }

  /**
   * Utility function to pause execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test Airtable connection
   * Useful for debugging API key or table issues
   */
  async testConnection(env) {
    try {
      if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID) {
        return { success: false, error: 'Airtable configuration missing' };
      }

      const url = `${this.baseUrl}/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_NAME || 'Form_Submissions'}`;
      const response = await fetch(url, {
        method: 'GET', // GET to fetch table info
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
}
