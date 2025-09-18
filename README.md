# Cloudflare Workers Form Handler

A production-ready, secure, and scalable form handler system built for Cloudflare Workers. This system accepts form submissions from multiple static websites and processes them by saving to Airtable and/or sending email notifications via Resend.

## 🚀 Features

- **Multi-domain Support**: Handle form submissions from multiple static websites
- **Airtable Integration**: Automatically save form data to Airtable
- **Email Notifications**: Send beautiful HTML emails via Resend
- **Security First**: CORS protection, rate limiting, input sanitization
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
```

### 4. Airtable Setup

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

### Basic Form Submission

Send a POST request to your worker URL:

```javascript
const formData = {
  name: "John Doe",
  email: "john@example.com",
  message: "Hello from my website!"
};

fetch('https://your-worker.your-subdomain.workers.dev', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(formData)
})
.then(response => response.json())
.then(data => console.log(data));
```

### HTML Form Example

```html
<form id="contact-form">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <textarea name="message" placeholder="Your Message" required></textarea>
  <button type="submit">Send Message</button>
</form>

<script>
document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  
  try {
    const response = await fetch('https://your-worker.your-subdomain.workers.dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Message sent successfully!');
      e.target.reset();
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    alert('Network error. Please try again.');
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

- **CORS Protection**: Configurable allowed origins
- **Rate Limiting**: IP-based request limiting
- **Input Sanitization**: XSS and injection protection
- **Validation**: Comprehensive form data validation
- **Security Headers**: XSS protection, content type options
- **API Key Authentication**: Optional API key protection

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
