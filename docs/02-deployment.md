# Deployment and Configuration Guide

This guide covers the necessary steps to configure and deploy the form handler worker to your Cloudflare account.

## Environment Variables

All configuration is handled through environment variables. For local development, you can set these in a `.env` file. For production, you must set them in your Cloudflare Worker's settings.

### Required Variables:

- `ALLOWED_ORIGINS`: A comma-separated list of URLs that are allowed to make requests to your worker.
  - *Example*: `https://mysite.com,https://myothersite.com`
- `TURNSTILE_SECRET_KEY`: Your Cloudflare Turnstile secret key.

### Optional Service Variables:

- **Airtable**:
  - `AIRTABLE_API_KEY`: Your Airtable personal access token.
  - `AIRTABLE_BASE_ID`: The ID of your Airtable base.
  - `AIRTABLE_TABLE_NAME`: The name of the table where submissions will be stored (defaults to `Form_Submissions`).
- **Resend (Email)**:
  - `RESEND_API_KEY`: Your API key from Resend.
  - `RESEND_FROM_EMAIL`: The email address the notification will be sent from (must be a verified domain in Resend).
  - `RESEND_TO_EMAIL`: The email address that will receive the notification.

### Optional Configuration Variables:

- `RATE_LIMIT_REQUESTS_PER_MINUTE`: The number of requests allowed per IP address per minute (defaults to `60`).
- `REQUIRED_FIELDS`: A comma-separated list of form fields that must be present in the submission.
  - *Example*: `name,email,message`
- `API_SECRET_KEY`: An optional secret key you can require for an extra layer of authentication (sent in the `Authorization: Bearer <key>` header).

## `wrangler.toml` Configuration

The `wrangler.toml` file is the central configuration file for your Cloudflare Worker.

### KV Namespace for Rate Limiting

The rate limiting feature requires a Cloudflare KV namespace to work correctly in a distributed environment.

1.  **Create the Namespace**:
    If you haven't already, create a KV namespace. The binding name **must** be `RATE_LIMITER`.
    ```bash
    wrangler kv:namespace create "RATE_LIMITER"
    ```

2.  **Update `wrangler.toml`**:
    Wrangler will output a configuration snippet. Copy and paste this into your `wrangler.toml` file. It should look like this:
    ```toml
    [[kv_namespaces]]
    binding = "RATE_LIMITER"
    id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    preview_id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ```
    Replace the `id` and `preview_id` with the actual values provided by Wrangler.

## Deployment Process

### Local Development

To run the worker locally for testing, use the `dev` script:

```bash
npm run dev
```
This will start a local server that reloads automatically when you make changes. It will use the variables from your `.env` file.

### Production Deployment

1.  **Set Production Environment Variables**:
    - Go to your Cloudflare Dashboard -> Workers & Pages.
    - Select your worker, then go to Settings -> Variables.
    - Add all the required environment variables from your `.env` file.
    - **Important**: For sensitive values like API keys, click "Encrypt" to store them securely.

2.  **Deploy the Worker**:
    Use the `deploy` script to publish your worker to the Cloudflare network.
    ```bash
    npm run deploy
    ```
    This command will bundle your code and upload it. Once deployed, it will be live at your worker's URL (e.g., `form-handler-worker.your-subdomain.workers.dev`).
