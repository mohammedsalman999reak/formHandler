export class EmailService {
  constructor() {
    this.baseUrl = 'https://api.resend.com';
  }

  async sendNotification(formData, env) {
    try {
      if (!env.RESEND_API_KEY) throw new Error('Resend API key not configured');
      if (!env.RESEND_FROM_EMAIL || !env.RESEND_TO_EMAIL) throw new Error('Email addresses not configured');

      const emailContent = this.prepareEmailContent(formData, env);
      const response = await this.makeResendRequest(emailContent, env);

      if (response.ok) {
        const result = await response.json();
        return { success: true, messageId: result.id, message: 'Email sent successfully' };
      } else {
        const errorData = await response.json();
        throw new Error(`Resend API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  prepareEmailContent(formData, env) {
    // Clean the form data before generating email
    const cleanedData = this.cleanFormData(formData);

    const subject = `New Form Submission from ${cleanedData.Name || cleanedData.name || 'User'}`;
    const htmlContent = this.generateHtmlEmail(cleanedData);
    const textContent = this.generateTextEmail(cleanedData);

    // Prepare email content
    const emailContent = {
      from: env.RESEND_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL],
      subject,
      html: htmlContent,
      text: textContent,
      reply_to: cleanedData.Email || cleanedData.email || null
    };

    // Add attachment if file data exists
    if (cleanedData.file && cleanedData.file.data) {
      emailContent.attachments = [
        {
          filename: cleanedData.file.filename || 'attachment',
          content: cleanedData.file.data, // base64 data
          content_type: cleanedData.file.type || 'application/octet-stream'
        }
      ];
    }

    return emailContent;
  }

  /**
   * Clean form data - remove undefined/null values and provide defaults
   */
  cleanFormData(formData) {
    const cleaned = {};

    for (const [key, value] of Object.entries(formData)) {
      // Skip undefined, null, empty, or "undefined" string values
      if (value !== undefined &&
          value !== null &&
          value !== '' &&
          value !== 'undefined' &&
          value !== 'null') {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  generateHtmlEmail(formData) {
    // Filter and format fields for display
    const fieldsHtml = Object.entries(formData)
      .filter(([key, value]) => {
        // Skip system fields, file data, and undefined values
        const isSystemField = ['Timestamp', 'IP Address', 'Origin', 'Submission ID', 'Environment', 'Created At', 'file'].includes(key);
        const isEmpty = value === undefined || value === null || value === '';

        return !isSystemField && !isEmpty;
      })
      .map(([key, value]) => {
        // Handle file info display differently
        if (key === 'file' && typeof value === 'object') {
          return `
            <div style="margin-bottom: 10px;">
              <strong>Attached File:</strong> ${value.filename || 'File'} (${this.formatFileSize(value.size)})
            </div>
          `;
        }
        return `
          <div style="margin-bottom: 10px;">
            <strong>${this.formatFieldName(key)}:</strong> ${this.escapeHtml(String(value))}
          </div>
        `;
      }).join('');

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2>New Form Submission</h2>
        ${fieldsHtml || '<p>No form data received</p>'}
        <hr>
        <div><strong>Timestamp:</strong> ${formData.Timestamp || new Date().toISOString()}</div>
        <div><strong>IP Address:</strong> ${formData['IP Address'] || 'Unknown'}</div>
        <div><strong>Origin:</strong> ${formData.Origin || 'Unknown'}</div>
        ${formData.file ? '<div><em>File attached to this email</em></div>' : ''}
      </div>
    `;
  }

  generateTextEmail(formData) {
    const fieldsText = Object.entries(formData)
      .filter(([key, value]) => {
        // Skip system fields, file data, and undefined values
        const isSystemField = ['Timestamp', 'IP Address', 'Origin', 'Submission ID', 'Environment', 'Created At', 'file'].includes(key);
        const isEmpty = value === undefined || value === null || value === '';

        return !isSystemField && !isEmpty;
      })
      .map(([key, value]) => {
        // Handle file info display differently
        if (key === 'file' && typeof value === 'object') {
          return `Attached File: ${value.filename || 'File'} (${this.formatFileSize(value.size)})`;
        }
        return `${this.formatFieldName(key)}: ${value}`;
      })
      .join('\n');

    return `
New Form Submission

${fieldsText || 'No form data received'}

---
Timestamp: ${formData.Timestamp || new Date().toISOString()}
IP Address: ${formData['IP Address'] || 'Unknown'}
Origin: ${formData.Origin || 'Unknown'}
${formData.file ? 'File attached to this email' : ''}
    `.trim();
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format field names for better display
   */
  formatFieldName(fieldName) {
    const nameMap = {
      'name': 'Name',
      'email': 'Email',
      'message': 'Message',
      'phone': 'Phone',
      'website': 'Website',
      'userAgent': 'User Agent',
      'referer': 'Referer',
      'fileName': 'File Name',
      'fileSize': 'File Size',
      'fileType': 'File Type'
    };

    return nameMap[fieldName] ||
           fieldName.replace(/([A-Z])/g, ' $1') // Add space before capital letters
                   .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
  }

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
    return await this.retryRequest(url, requestOptions, 3);
  }

  async retryRequest(url, options, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok || (response.status >= 400 && response.status < 500)) return response;
        if (attempt === maxRetries) return response;
        await this.delay(Math.pow(2, attempt) * 1000);
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) throw error;
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    throw lastError;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
