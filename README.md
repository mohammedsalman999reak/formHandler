# Cloudflare Workers Form Handler

A production-ready, secure, and scalable form handler system built for Cloudflare Workers. This system accepts form submissions from multiple static websites and processes them by saving to Airtable and/or sending email notifications via Resend.

## 🚀 Features

- **Multi-domain Support**: Handle form submissions from multiple static websites
- **Airtable Integration**: Automatically save form data to Airtable
- **Email Notifications**: Send beautiful HTML emails via Resend
- **Security First**: CSRF protection, Cloudflare Turnstile (spam protection), CORS, rate limiting, and input sanitization.
- **Production Ready**: Comprehensive error handling and logging
- **Easy Configuration**: Environment-based configuration
- **Modular Design**: Clean, maintainable code structure

## 📁 Project Structure

```
form-handler-worker/
├── src/
│   ├── index.js              # Main Cloudflare Worker handler
│   ├── services/
│   │   ├── airtable.js       # Airtable integration service
│   │   └── email.js          # Resend email service
│   └── utils/
│       ├── validator.js      # Form validation utilities
│       ├── security.js       # Security and CORS helpers
│       └── logger.js         # Logging utilities
├── package.json              # Dependencies and scripts
├── wrangler.toml            # Cloudflare Workers configuration
├── env.example              # Environment variables template
└── README.md                # This file
```

## 🛠️ Setup and Installation

### 1. Prerequisites

- Node.js 18+ 
- Cloudflare account
- Airtable account (optional)
- Resend account (optional)

### 2. Installation

```bash
# Clone or download the project
cd form-handler-worker

# Install dependencies
npm install

# Copy environment template
cp env.example .env
```

### 3. Environment Configuration

Edit your `.env` file with your actual credentials:

```bash
# Airtable Configuration
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here
AIRTABLE_TABLE_NAME=Form_Submissions

# Resend Email Configuration
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_TO_EMAIL=admin@yourdomain.com

# Security Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://anotherdomain.com
API_SECRET_KEY=your_secret_key_for_authentication

# Optional: Rate limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Optional: Form validation
REQUIRED_FIELDS=name,email,message

# Cloudflare Turnstile (for spam protection)
TURNSTILE_SECRET_KEY=your_turnstile_secret_key_here
```

### 4. Security Setup (Required)

#### a. Rate Limiting (KV Namespace)

This worker uses Cloudflare KV for distributed rate limiting. You must create a KV namespace and link it.

1.  **Create a KV Namespace** using the Wrangler CLI or the Cloudflare dashboard:
    ```bash
    wrangler kv:namespace create "RATE_LIMITER"
    ```
2.  **Copy the output** from the command. It will look like this:
    ```
    🌀  Creating namespace "RATE_LIMITER"
    ✨  Success!
    Add the following to your wrangler.toml:
    [[kv_namespaces]]
    binding = "RATE_LIMITER"
    id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ```
3.  **Update `wrangler.toml`**: Open your `wrangler.toml` file and paste the `[[kv_namespaces]]` configuration into it.

#### b. Spam Protection (Cloudflare Turnstile)

1.  **Create a Turnstile Widget**:
    *   Go to your Cloudflare Dashboard -> Turnstile.
    *   Click "Add site" and follow the instructions. Choose the "Invisible" widget type for the best user experience.
    *   Note the **Site Key** (for your frontend) and the **Secret Key**.
2.  **Set Environment Variable**:
    *   Take the **Secret Key** from the previous step and set it as the `TURNSTILE_SECRET_KEY` environment variable in your `.env` file or in the Cloudflare dashboard.

### 5. Airtable Setup

1. Create a new Airtable base
2. Create a table named "Form_Submissions" (or update `AIRTABLE_TABLE_NAME`)
3. Add these fields to your table:
   - Name (Single line text)
   - Email (Email)
   - Message (Long text)
   - Timestamp (Date)
   - IP Address (Single line text)
   - Origin (Single line text)

### 5. Resend Setup

1. Sign up for Resend account
2. Verify your domain
3. Get your API key
4. Set up your from and to email addresses

## 🚀 Deployment

### Development

```bash
# Start local development server
npm run dev
```

### Production

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Deploy to specific environment
wrangler deploy --env production
```

### Environment Variables in Cloudflare

Set your environment variables in Cloudflare Dashboard:

1. Go to Workers & Pages → Your Worker → Settings → Variables
2. Add all variables from your `.env` file
3. Make sure to mark sensitive variables as "Encrypted"

Or use Wrangler CLI:

```bash
# Set environment variables
wrangler secret put AIRTABLE_API_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put API_SECRET_KEY

# Set regular variables
wrangler env put ALLOWED_ORIGINS "https://yourdomain.com,https://anotherdomain.com"
```

## 📝 Usage

The form submission process now requires three steps to ensure security:
1.  **Render the Turnstile Widget** on your frontend.
2.  **Fetch a CSRF token** from the worker.
3.  **Submit the form** with the form data, the Turnstile response, and the CSRF token.

### Full Frontend Example

This example shows how to integrate Turnstile and the CSRF token flow.

```html
<!-- Add the Turnstile script to your <head> -->
<script src="https://challenges.cloudflare.com/turnstile/v2/api.js" async defer></script>

<form id="contact-form">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <textarea name="message" placeholder="Your Message" required></textarea>

  <!-- Add the Turnstile widget to your form -->
  <!-- Replace with your Turnstile Site Key -->
  <div class="cf-turnstile" data-sitekey="your_turnstile_site_key_here"></div>

  <button type="submit">Send Message</button>
</form>

<script>
  const form = document.getElementById('contact-form');
  const workerUrl = 'https://your-worker.your-subdomain.workers.dev';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      // 1. Fetch CSRF token
      const csrfResponse = await fetch(`${workerUrl}/csrf-token`);
      const { csrfToken } = await csrfResponse.json();

      if (!csrfToken) {
        throw new Error('Could not retrieve CSRF token.');
      }

      // 2. Get form data, including the Turnstile response
      const formData = new FormData(form);
      const data = Object.fromEntries(formData); // This includes 'cf-turnstile-response'

      if (!data['cf-turnstile-response']) {
        alert('Spam protection challenge failed. Please refresh and try again.');
        return;
      }

      // 3. Submit the form with the CSRF token in the header
      const submitResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken // Send the token in the header
        },
        body: JSON.stringify(data)
      });

      const result = await submitResponse.json();

      if (result.success) {
        alert('Message sent successfully!');
        form.reset();
      } else {
        alert(`Error: ${result.error || 'An unknown error occurred.'}`);
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('A network or system error occurred. Please try again.');
    } finally {
      // It's good practice to reset the Turnstile widget after submission
      if (window.turnstile) {
        window.turnstile.reset();
      }
    }
  });
</script>
```

## 🔧 Configuration Options

### Required Fields

Set `REQUIRED_FIELDS` to specify which fields are mandatory:

```bash
REQUIRED_FIELDS=name,email,message,phone
```

### Rate Limiting

Configure rate limiting per IP address:

```bash
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

### CORS Origins

Specify allowed origins for CORS:

```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://anotherdomain.com,https://*.subdomain.com
```

### API Authentication

Add API key authentication:

```bash
API_SECRET_KEY=your-secret-key-here
```

Then include in requests:

```javascript
fetch('https://your-worker.your-subdomain.workers.dev', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-secret-key-here'
  },
  body: JSON.stringify(formData)
});
```

## 📊 Response Format

### Success Response

```json
{
  "success": true,
  "submissionId": "sub_1704067200000_abc123def",
  "airtable": {
    "success": true,
    "recordId": "rec1234567890",
    "message": "Data saved to Airtable successfully"
  },
  "email": {
    "success": true,
    "messageId": "msg_1234567890",
    "message": "Email sent successfully"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "email is required",
    "Invalid email format"
  ]
}
```

## 🔒 Security Features

- **CSRF Protection**: Stateless double-submit cookie pattern to prevent cross-site request forgery.
- **Spam Protection**: Integrates with Cloudflare Turnstile to block bots.
- **CORS Protection**: Configurable allowed origins to lock down access.
- **Rate Limiting**: Distributed rate limiting using Cloudflare KV to prevent abuse.
- **Input Sanitization**: Encodes HTML in submissions to provide defense-in-depth against XSS.
- **Validation**: Comprehensive form data validation (required fields, formats, lengths).
- **Security Headers**: Includes standard security headers like `X-Frame-Options` and `X-XSS-Protection`.
- **API Key Authentication**: Optional secret key authentication for an extra layer of protection.

## 🐛 Error Handling

The system includes comprehensive error handling:

- **Validation Errors**: Field validation with detailed messages
- **Network Errors**: Automatic retry with exponential backoff
- **Service Errors**: Graceful degradation if services are unavailable
- **Rate Limiting**: Clear rate limit exceeded messages
- **CORS Errors**: Proper CORS error responses

## 📈 Monitoring and Logging

All requests and errors are logged with:

- Request details (IP, user agent, origin)
- Processing results (success/failure)
- Performance metrics
- Security events
- Service-specific errors

## 🔄 Extending the System

### Adding New Services

1. Create a new service in `src/services/`
2. Implement the service interface
3. Add to the main handler in `src/index.js`

### Custom Validation

1. Extend `FormValidator` class in `src/utils/validator.js`
2. Add new validation rules
3. Update field mapping as needed

### Custom Email Templates

1. Modify `generateHtmlEmail()` in `src/services/email.js`
2. Update CSS and HTML structure
3. Add new template variables

## 🌐 Multi-Website Usage

This system is designed to handle multiple websites:

1. **Single Worker**: One worker handles all websites
2. **CORS Configuration**: Set `ALLOWED_ORIGINS` with all your domains
3. **Origin Tracking**: Each submission includes the origin domain
4. **Separate Airtable Tables**: Use different tables for different websites

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**: Check `ALLOWED_ORIGINS` configuration
2. **Airtable Errors**: Verify API key and base ID
3. **Email Errors**: Check Resend API key and domain verification
4. **Rate Limiting**: Adjust `RATE_LIMIT_REQUESTS_PER_MINUTE`

### Debug Mode

Enable debug logging by setting log level:

```javascript
// In your worker code
logger.setLogLevel('DEBUG');
```

## 📄 License

MIT License - feel free to use in your projects!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📞 Support

For support and questions, please open an issue in the repository.

---

**Built with ❤️ for the Cloudflare Workers ecosystem**
