# Email (Resend) Integration Guide

This guide explains how to configure the form handler to send email notifications for new submissions using Resend.

## What It Does

The Resend integration sends a formatted HTML email to a specified address every time a valid form submission is received. This provides instant notification, allowing you to respond to inquiries quickly.

## How It Works Internally

When a form submission is successfully validated, the `EmailService` in `src/services/email.js` is triggered.

1.  **Configuration Check**: It first checks if the `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_TO_EMAIL` environment variables are present. If not, the service is skipped.
2.  **Email Generation**: It constructs both an HTML and a plain-text version of the email.
    - The HTML version is formatted for readability with clear labels for each form field.
    - **Security**: To prevent XSS attacks within the email client, all user-submitted data is HTML-escaped before being included in the email body.
3.  **API Request**: It sends the email data to the Resend API (`https://api.resend.com/emails`) via a `POST` request.
4.  **Retry Logic**: Like the Airtable service, it will automatically retry the request up to 3 times with exponential backoff if a network or server error occurs.
5.  **Error Handling**: If the Resend API returns an error (e.g., invalid API key, unverified domain), the error is caught gracefully and logged. The overall submission is still considered successful if another service (like Airtable) succeeds.

## Production Behavior

In production, the email service is highly reliable due to the built-in retry mechanism. Emails are typically delivered within seconds of a successful form submission. If the Resend API is temporarily unavailable, the worker will attempt to send the email again, minimizing the chance of missed notifications.

## How to Use It

### 1. Set Up Your Resend Account

1.  Create an account at [resend.com](https://resend.com).
2.  **Verify Your Domain**: You must add and verify the domain you want to send emails from (e.g., `yourdomain.com`). You cannot send from unverified domains. Follow the instructions in the Resend dashboard to add the necessary DNS records.
3.  **Create an API Key**: Go to the "API Keys" section in your Resend dashboard and create a new API key. Copy this key.

### 2. Set Environment Variables

Add your Resend API key and desired email addresses to your environment variables (`.env` file or Cloudflare dashboard):

```bash
# Resend Email Configuration
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@your-verified-domain.com # Must use your verified domain
RESEND_TO_EMAIL=your-inbox@example.com # Where you want to receive notifications
```

- `RESEND_FROM_EMAIL`: This is the "sender" address. It **must** belong to a domain you have verified in Resend.
- `RESEND_TO_EMAIL`: This is the recipient's address (your inbox).

The email integration is now active. You will receive an email for every successful form submission.
