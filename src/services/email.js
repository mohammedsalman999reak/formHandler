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
    const subject = 'New Form Submission';
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
    const fieldsHtml = Object.entries(formData)
      .filter(([key]) => !['Timestamp', 'IP Address', 'Origin'].includes(key))
      .map(([key, value]) => `
        <div style="margin-bottom: 10px;">
          <strong>${key}:</strong> ${this.escapeHtml(String(value))}
        </div>
      `).join('');

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2>New Form Submission</h2>
        ${fieldsHtml}
        <hr>
        <div>Timestamp: ${formData.Timestamp}</div>
        <div>IP Address: ${formData['IP Address']}</div>
        <div>Origin: ${formData.Origin}</div>
      </div>
    `;
  }

  generateTextEmail(formData) {
    const fieldsText = Object.entries(formData)
      .filter(([key]) => !['Timestamp', 'IP Address', 'Origin'].includes(key))
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return `
New Form Submission

${fieldsText}

---
Timestamp: ${formData.Timestamp}
IP Address: ${formData['IP Address']}
Origin: ${formData.Origin}
    `.trim();
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

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
