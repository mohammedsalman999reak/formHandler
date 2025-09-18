# Deployment Guide

This guide covers deploying the Cloudflare Workers Form Handler to production.

## 🚀 Quick Deployment

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Deploy

```bash
# Deploy to development
wrangler deploy

# Deploy to production
wrangler deploy --env production
```

## 🔧 Environment Setup

### Development Environment

```bash
# Set development environment variables
wrangler env put ALLOWED_ORIGINS "http://localhost:3000,http://localhost:8080"
wrangler env put ENVIRONMENT "development"
wrangler env put RATE_LIMIT_REQUESTS_PER_MINUTE "120"

# Set secrets (will prompt for values)
wrangler secret put AIRTABLE_API_KEY --env development
wrangler secret put RESEND_API_KEY --env development
```

### Staging Environment

```bash
# Set staging environment variables
wrangler env put ALLOWED_ORIGINS "https://staging.yourdomain.com" --env staging
wrangler env put ENVIRONMENT "staging"
wrangler env put RATE_LIMIT_REQUESTS_PER_MINUTE "60"

# Set secrets
wrangler secret put AIRTABLE_API_KEY --env staging
wrangler secret put RESEND_API_KEY --env staging
```

### Production Environment

```bash
# Set production environment variables
wrangler env put ALLOWED_ORIGINS "https://yourdomain.com,https://www.yourdomain.com" --env production
wrangler env put ENVIRONMENT "production"
wrangler env put RATE_LIMIT_REQUESTS_PER_MINUTE "30"
wrangler env put REQUIRED_FIELDS "name,email,message" --env production

# Set secrets
wrangler secret put AIRTABLE_API_KEY --env production
wrangler secret put RESEND_API_KEY --env production
wrangler secret put API_SECRET_KEY --env production
```

## 🌐 Custom Domain Setup

### 1. Add Custom Domain

```bash
# Add custom domain to your worker
wrangler custom-domains add yourdomain.com --env production
```

### 2. Update DNS

Add a CNAME record pointing to your worker:

```
Type: CNAME
Name: api (or forms)
Value: your-worker.your-subdomain.workers.dev
```

### 3. Update CORS Origins

```bash
wrangler env put ALLOWED_ORIGINS "https://yourdomain.com,https://api.yourdomain.com" --env production
```

## 📊 Monitoring Setup

### 1. Enable Analytics

```bash
# Enable analytics for your worker
wrangler analytics enable
```

### 2. Set up Alerts

In Cloudflare Dashboard:
1. Go to Workers & Pages → Your Worker → Analytics
2. Set up alerts for:
   - High error rates
   - High request volumes
   - Response time spikes

### 3. Log Management

For production, consider:
- Using Cloudflare Logpush for detailed logs
- Setting up external logging service (Datadog, New Relic)
- Implementing log rotation

## 🔒 Security Hardening

### 1. API Key Authentication

```bash
# Generate a strong API key
openssl rand -hex 32

# Set as secret
wrangler secret put API_SECRET_KEY --env production
```

### 2. Rate Limiting

Adjust rate limits based on your needs:

```bash
# Conservative rate limiting
wrangler env put RATE_LIMIT_REQUESTS_PER_MINUTE "10" --env production

# Aggressive rate limiting
wrangler env put RATE_LIMIT_REQUESTS_PER_MINUTE "100" --env production
```

### 3. CORS Configuration

Be specific with allowed origins:

```bash
# Specific domains only
wrangler env put ALLOWED_ORIGINS "https://yourdomain.com,https://www.yourdomain.com" --env production

# Subdomain wildcard (use carefully)
wrangler env put ALLOWED_ORIGINS "https://*.yourdomain.com" --env production
```

## 🧪 Testing Deployment

### 1. Health Check

```bash
# Test basic functionality
curl -X POST https://your-worker.your-subdomain.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","message":"Health check"}'
```

### 2. CORS Test

```bash
# Test CORS from browser console
fetch('https://your-worker.your-subdomain.workers.dev', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({name:'Test',email:'test@example.com',message:'CORS test'})
})
.then(r => r.json())
.then(console.log);
```

### 3. Error Handling Test

```bash
# Test validation errors
curl -X POST https://your-worker.your-subdomain.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'

# Test rate limiting
for i in {1..10}; do
  curl -X POST https://your-worker.your-subdomain.workers.dev \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@example.com","message":"Rate limit test"}'
done
```

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy Form Handler

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Deploy to Staging
        if: github.ref == 'refs/heads/main'
        run: wrangler deploy --env staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          
      - name: Deploy to Production
        if: github.ref == 'refs/heads/main'
        run: wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Environment Variables in CI/CD

Set these secrets in your CI/CD platform:

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `AIRTABLE_API_KEY`: Your Airtable API key
- `RESEND_API_KEY`: Your Resend API key
- `API_SECRET_KEY`: Your custom API secret key

## 📈 Performance Optimization

### 1. Worker Optimization

- Use `wrangler dev` for local testing
- Monitor bundle size with `wrangler deploy --dry-run`
- Optimize imports and remove unused code

### 2. Caching Strategy

Consider implementing caching for:
- Airtable schema validation
- Email template compilation
- Rate limit data

### 3. Resource Limits

Monitor your Cloudflare Workers usage:
- CPU time limits
- Memory usage
- Request count
- Outbound requests

## 🚨 Rollback Strategy

### 1. Quick Rollback

```bash
# Rollback to previous version
wrangler rollback

# Rollback specific environment
wrangler rollback --env production
```

### 2. Emergency Disable

```bash
# Disable worker temporarily
wrangler delete your-worker-name --env production
```

## 📋 Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Secrets set securely
- [ ] CORS origins configured
- [ ] Rate limiting configured
- [ ] Airtable integration tested
- [ ] Email integration tested
- [ ] Custom domain configured (if needed)
- [ ] Monitoring set up
- [ ] Error handling tested
- [ ] Security review completed
- [ ] Performance testing done
- [ ] Rollback plan ready

## 🔍 Post-deployment Verification

1. **Functionality Test**: Submit test forms
2. **CORS Test**: Test from different origins
3. **Error Handling**: Test validation and error cases
4. **Rate Limiting**: Test rate limit enforcement
5. **Monitoring**: Check logs and analytics
6. **Performance**: Monitor response times
7. **Security**: Verify security headers and CORS

## 📞 Troubleshooting

### Common Deployment Issues

1. **Environment Variables Not Set**
   ```bash
   # Check current variables
   wrangler env list
   
   # Set missing variables
   wrangler env put VARIABLE_NAME "value"
   ```

2. **Secrets Not Working**
   ```bash
   # Check secrets (names only, not values)
   wrangler secret list
   
   # Reset secret
   wrangler secret delete SECRET_NAME
   wrangler secret put SECRET_NAME
   ```

3. **CORS Issues**
   - Check `ALLOWED_ORIGINS` configuration
   - Verify domain spelling and protocol (http vs https)
   - Test with browser developer tools

4. **Service Integration Failures**
   - Verify API keys are correct
   - Check service status pages
   - Review worker logs for specific errors

### Getting Help

- Check Cloudflare Workers documentation
- Review service-specific documentation (Airtable, Resend)
- Check worker logs in Cloudflare Dashboard
- Open an issue in the repository
